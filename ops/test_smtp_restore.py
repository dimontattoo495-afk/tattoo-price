"""Synthetic, offline regressions for safe Beget SMTP installer."""
import importlib.util
import pathlib
import unittest

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("mailrepair", HERE/"beget-restore-auth-smtp.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class SafetyTests(unittest.TestCase):
    def setUp(self):
        mod.KEYS.pop("SMTP_PASS",None)

    def test_dotenv_replacements_single_quotes(self):
        env="SMTP_HOST=supabase-mail\nSMTP_PORT=2500\nOTHER_KEY="+"$"+"{KEEP_ME}\n"
        values={**mod.KEYS,"SMTP_PASS":"my-123-strong#$password"}
        rendered=mod.render(env,values)
        self.assertEqual(rendered.count("SMTP_HOST="),1)
        self.assertIn("SMTP_HOST='smtp.beget.com'",rendered)
        self.assertIn("SMTP_PORT='465'",rendered)
        self.assertIn("SMTP_PASS='my-123-strong#$password'",rendered)
        self.assertIn("OTHER_KEY="+"$"+"{KEEP_ME}",rendered)

    def test_unsafe_password_rejected(self):
        for password in ("O'Reilly","a\\value","bad\nline"):
            with self.subTest(password_repr=repr(password)):
                with self.assertRaises(RuntimeError):
                    mod.render("SMTP_HOST=supabase-mail\n",{"SMTP_PASS":password})

    def test_duplicate_smtp_key_rejected(self):
        with self.assertRaises(RuntimeError):
            mod.render("SMTP_HOST=a\nSMTP_HOST=b\n",{"SMTP_HOST":"smtp.beget.com"})

    def test_compose_allows_only_auth_smtp_changes(self):
        values={**mod.KEYS,"SMTP_PASS":"very-secret"}
        base={"services":{
            "auth":{"environment":{
                "GOTRUE_SMTP_HOST":"supabase-mail",
                "GOTRUE_SMTP_PORT":"2500",
                "GOTRUE_SMTP_ADMIN_EMAIL":"example@example.invalid",
                "GOTRUE_SMTP_USER":"test",
                "GOTRUE_SMTP_PASS":"a",
                "GOTRUE_SMTP_SENDER_NAME":"old",
                "GOTRUE_MAILER_AUTOCONFIRM":"false",
                "GOTRUE_JWT_SECRET":"irrelevant_secret_test_only"
            }},
            "db":{"environment":{"POSTGRES_DB":"postgres"}},
            "realtime":{"environment":{"MODE":"prod"}},
        }}
        import copy
        valid=copy.deepcopy(base)
        for key,gotrue in mod.SMTP_ENV.items():
            valid["services"]["auth"]["environment"][gotrue]=values[key]
        mod.KEYS["SMTP_PASS"]="very-secret"
        mod.compare(base,valid,"auth")
        bad=copy.deepcopy(valid)
        bad["services"]["auth"]["environment"]["GOTRUE_MAILER_AUTOCONFIRM"]="true"
        with self.assertRaises(RuntimeError):
            mod.compare(base,bad,"auth")
        bad=copy.deepcopy(valid)
        bad["services"]["db"]["environment"]["POSTGRES_DB"]="changed"
        with self.assertRaises(RuntimeError):
            mod.compare(base,bad,"auth")
        bad=copy.deepcopy(valid)
        bad["services"]["auth"]["environment"]["GOTRUE_JWT_SECRET"]="changed"
        with self.assertRaises(RuntimeError):
            mod.compare(base,bad,"auth")

    def test_never_enable_global_autoconfirm(self):
        src=(HERE/"beget-restore-auth-smtp.py").read_text(encoding="utf-8")
        self.assertNotIn('"GOTRUE_MAILER_AUTOCONFIRM":"true"',src)
        self.assertIn('["up","-d","--no-deps",service]',src)
        self.assertIn('shutil.copyfile(backup,envpath)',src)
        self.assertIn('getpass.getpass(',src)
        self.assertIn('ssl.create_default_context()',src)

if __name__=="__main__":
    unittest.main()
