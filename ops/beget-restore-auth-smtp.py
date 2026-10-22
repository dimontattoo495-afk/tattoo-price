#!/usr/bin/env python3
"""Safely restore production Supabase Auth SMTP using a new Beget mailbox.

Run ON the owner's Beget VPS as root. This is production Auth shared by
TATTOO PRICE and the closed ZAGS pilot. The script:
  - validates the existing SMTP and Docker Compose source;
  - tests TLS+SMTP authentication BEFORE touching config;
  - ensures Docker Compose changes ONLY six Auth SMTP variables;
  - backs up .env with root-only permissions;
  - recreates ONLY the 'auth' Compose service; verifies live SMTP env;
  - attempts automatic rollback if the restart/verification fails.
Never prints the password or commits it to GitHub. Doesn't touch databases,
other Docker services, login/signup policies or T-Bank payments.
"""
import copy
import datetime
import fcntl
import getpass
import json
import os
import pathlib
import re
import shutil
import smtplib
import ssl
import subprocess
import sys
import time
from email.message import EmailMessage

MAILBOX = "noreply@yabylzdes.ru"
HOST = "smtp.beget.com"
PORT = "465"
KEYS = {
    "SMTP_ADMIN_EMAIL": MAILBOX,
    "SMTP_HOST": HOST,
    "SMTP_PORT": PORT,
    "SMTP_USER": MAILBOX,
    "SMTP_SENDER_NAME": "TATTOO PRICE",
}
SMTP_ENV = {
    "SMTP_ADMIN_EMAIL": "GOTRUE_SMTP_ADMIN_EMAIL",
    "SMTP_HOST": "GOTRUE_SMTP_HOST",
    "SMTP_PORT": "GOTRUE_SMTP_PORT",
    "SMTP_USER": "GOTRUE_SMTP_USER",
    "SMTP_PASS": "GOTRUE_SMTP_PASS",
    "SMTP_SENDER_NAME": "GOTRUE_SMTP_SENDER_NAME",
}

def stop(reason):
    print("STOP: "+reason)
    sys.exit(1)

def cmd(args, *, timeout=45):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError("Command unavailable or timed out")
    if p.returncode:
        raise RuntimeError("Command returned failure")
    return p.stdout

def inspect():
    obj = json.loads(cmd(["docker","inspect","supabase-auth"]))
    if len(obj)!=1:
        raise RuntimeError("Unexpected auth container")
    return obj[0]

def env_of(item):
    return dict(x.split("=",1) for x in item["Config"]["Env"] if "=" in x)

def compose(files, directory, envfile, command):
    args = ["docker","compose","--project-directory",str(directory),"--env-file",str(envfile)]
    for file in files:
        args.extend(["-f",str(file)])
    return cmd(args+command,timeout=80)

def render(text, values):
    # Compose dotenv single-quoted values are literals and do not interpolate $.
    # Reject problematic password characters rather than mishandling escaping.
    for key,value in values.items():
        if not value or any(c in value for c in "\r\n'\\"):
            raise RuntimeError("One or more SMTP values cannot be safely written to Compose dotenv")
    seen=set()
    lines=[]
    pattern=re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=")
    for line in text.splitlines(keepends=True):
        match=pattern.match(line)
        key=match.group(1) if match else None
        if key in values:
            if key in seen:
                raise RuntimeError("Ambiguous duplicate SMTP keys in .env")
            seen.add(key)
            lines.append(key+"='"+values[key]+"'\n")
        else:
            lines.append(line if line.endswith("\n") else line+"\n")
    for key in values:
        if key not in seen:
            lines.append(key+"='"+values[key]+"'\n")
    return "".join(lines)

def service_environment(full, name):
    svc = full.get("services",{}).get(name,{})
    if not isinstance(svc,dict):
        raise RuntimeError("Compose auth service missing")
    env = svc.get("environment",{})
    if isinstance(env,list):
        env = dict(i.split("=",1) for i in env if "=" in i)
    if not isinstance(env,dict):
        raise RuntimeError("Unexpected Compose Auth environment shape")
    return env

def compare(old, new, service):
    if set(old.get("services",{}))!=set(new.get("services",{})):
        raise RuntimeError("Docker Compose service set would change")
    base=copy.deepcopy(old)
    prospective=copy.deepcopy(new)
    for cfg in (base, prospective):
        item=cfg["services"][service]
        env=item["environment"]
        if not isinstance(env,dict):
            raise RuntimeError("Expected Compose environment dictionary")
        for key in SMTP_ENV.values():
            env.pop(key,None)
    if base != prospective:
        raise RuntimeError("Changes extend beyond Auth SMTP variables. Refusing update")
    oldenv=service_environment(old,service)
    newenv=service_environment(new,service)
    for source,target in SMTP_ENV.items():
        if str(newenv.get(target,""))!=str(KEYS[source]):
            raise RuntimeError("Compose is not reading the expected SMTP settings")
    if oldenv.get("GOTRUE_MAILER_AUTOCONFIRM") != newenv.get("GOTRUE_MAILER_AUTOCONFIRM"):
        raise RuntimeError("Email confirmation policy unexpectedly differs")

def write_private(path, data):
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
    fd=os.open(str(path),flags,0o600)
    with os.fdopen(fd,"w",encoding="utf-8",newline="\n") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(path,0o600)

def check_smtp(password):
    ctx=ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(HOST,int(PORT),timeout=14,context=ctx) as c:
            c.ehlo()
            c.login(MAILBOX,password)
            # Submit a harmless verification message to the newly owned mailbox.
            msg=EmailMessage()
            msg["From"]=MAILBOX
            msg["To"]=MAILBOX
            msg["Subject"]="Beget SMTP self-test for TATTOO PRICE"
            msg.set_content("This is a one-time SMTP submission test. It is not a user signup.")
            refused=c.send_message(msg)
            if refused:
                raise RuntimeError("SMTP test recipient refused")
    except (smtplib.SMTPException,ssl.SSLError,OSError):
        raise RuntimeError("SMTP authentication, encryption or submission FAILED. No configuration changed")

def verify_live(expected):
    for _ in range(12):
        try:
            obj=inspect()
            live=env_of(obj)
            if obj["State"]["Status"]!="running":
                time.sleep(2)
                continue
            if all(str(live.get(target,""))==str(expected[source])
                   for source,target in SMTP_ENV.items()):
                health=obj["State"].get("Health",{}).get("Status")
                if health in (None,"healthy"):
                    return True
            time.sleep(2)
        except Exception:
            time.sleep(2)
    return False

def main():
    os.umask(0o077)
    if os.geteuid()!=0:
        stop("Execute inside Beget SSH as root, NOT in Windows PowerShell")
    backups=pathlib.Path("/root/backups")
    if not backups.is_dir() or not (backups/"tattoo-price-2026-10-21.dump").is_file():
        stop("Existing Beget safety backups not present")
    lock=open(backups/".tattoo-price-smtp.lock","a+")
    try:
        fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        stop("Another SMTP repair is running")
    try:
        obj=inspect()
        labels=obj["Config"].get("Labels") or {}
        service=labels.get("com.docker.compose.service")
        work=labels.get("com.docker.compose.project.working_dir")
        config_files=labels.get("com.docker.compose.project.config_files")
        if not service or not work or not config_files:
            raise RuntimeError("Supabase Auth is not identifiable as a Docker Compose service")
        workdir=pathlib.Path(work).resolve(strict=True)
        files=[pathlib.Path(f) if pathlib.Path(f).is_absolute() else workdir/f
               for f in config_files.split(",")]
        if not all(p.is_file() for p in files):
            raise RuntimeError("Original Docker Compose configuration file is missing")
        envpath=workdir/".env"
        if not envpath.is_file() or envpath.is_symlink():
            raise RuntimeError("Expected Docker Compose .env missing or symlinked")
        live=env_of(obj)
        if live.get("GOTRUE_MAILER_AUTOCONFIRM","").lower()!="false":
            raise RuntimeError("Confirmation policy no longer matches audited production")
        if not (live.get("GOTRUE_SMTP_PORT")=="2500"
                and live.get("GOTRUE_SMTP_HOST") in
                    ("supabase-mail","inbucket","localhost","127.0.0.1")):
            raise RuntimeError("SMTP is no longer the expected test configuration; review before altering")
        original=envpath.read_text(encoding="utf-8")
        before=json.loads(compose(files,workdir,envpath,["config","--format","json"]))
        current=service_environment(before,service)
        for key in ("GOTRUE_SMTP_HOST","GOTRUE_SMTP_PORT"):
            if str(current.get(key,""))!=str(live.get(key,"")):
                raise RuntimeError("Active Auth does not match this Compose source; refusing update")
        print("CHECK=FOUND_CORRECT_SHARED_BEGET_AUTH_CONFIGURATION")
        print("SMTP_TEST=CHECKING_TLS_LOGIN_AND_SELF_MESSAGE")
        password=getpass.getpass("Password of noreply@yabylzdes.ru (hidden): ")
        if not password:
            raise RuntimeError("Mailbox password empty")
        check_smtp(password)
        print("SMTP_TEST=PASS_TLS_LOGIN_AND_MESSAGE_ACCEPTED")
        KEYS["SMTP_PASS"]=password
        candidate=render(original,KEYS)
        # Never print Compose 'config', which contains secrets.
        staged=workdir/(".env.smtp-staged-"+str(os.getpid()))
        backup=backups/("auth-smtp-"+datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")+".env.backup")
        applied=False
        try:
            write_private(staged,candidate)
            after=json.loads(compose(files,workdir,staged,["config","--format","json"]))
            compare(before,after,service)
            print("SCOPE=ONLY_SIX_SMTP_VARIABLES_IN_AUTH_CONFIRMED")
            print("A brief Auth-only recreation is required; TATTOO PRICE listings/payments and databases stay untouched.")
            answer=input("To apply the change type APPLY (otherwise nothing changes): ").strip()
            if answer!="APPLY":
                print("STOP=USER_CANCELLED_NO_CHANGES")
                return
            shutil.copyfile(envpath,backup)
            os.chmod(backup,0o600)
            os.replace(staged,envpath)
            os.chmod(envpath,0o600)
            applied=True
            try:
                compose(files,workdir,envpath,["up","-d","--no-deps",service])
                if not verify_live(KEYS):
                    raise RuntimeError("Live Auth health or SMTP settings not verified")
            except Exception:
                print("ROLLBACK=RESTORING_ORIGINAL_ENV_AND_AUTH")
                shutil.copyfile(backup,envpath)
                os.chmod(envpath,0o600)
                try:
                    compose(files,workdir,envpath,["up","-d","--no-deps",service])
                    print("ROLLBACK=RESTARTED_PREVIOUS_AUTH_CONFIG")
                except Exception:
                    print("ROLLBACK=FAILED_NEEDS_MANUAL_REVIEW")
                raise RuntimeError("Auth verification failed; attempted rollback")
            print("PASS: AUTH_SMTP=smtp.beget.com:465")
            print("PASS: MAILBOX_SMTP_VERIFIED")
            print("PASS: AUTH_RECREATED_ALONE")
            print("BACKUP_EXISTS=YES (root-only)")
            print("NEXT: test real TATTOO PRICE signup or password recovery and email delivery")
        finally:
            if staged.exists():
                staged.unlink()
    except Exception as exc:
        stop(str(exc))

if __name__=="__main__":
    main()
