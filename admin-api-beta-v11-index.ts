import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.map(String).filter(Boolean))];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("tp_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "");

  if (action === "summary") {
    const [
      { data: stats, error: statsError },
      { data: betaSettings, error: betaError },
    ] = await Promise.all([
      supabase.rpc("tp_admin_dashboard_stats"),
      supabase.rpc("tp_get_public_settings"),
    ]);

    if (statsError) {
      return json({ error: statsError.message }, 500);
    }

    if (betaError) {
      return json({ error: betaError.message }, 500);
    }

    return json({
      ok: true,
      summary: stats || {},
      beta_settings: betaSettings || {},
      admin_email: userData.user.email || null,
    });
  }

  if (action === "list") {
    await supabase.rpc("tp_expire_due_listings");

    const statusFilter = String(body.status || "").trim();

    let query = supabase
      .from("tp_listings")
      .select(`
        id,
        public_no,
        master_name,
        studio_name,
        city,
        style,
        title,
        description,
        work_price,
        price_type,
        telegram_url,
        vk_url,
        website_url,
        plan,
        placement_price,
        status,
        payment_status,
        is_beta_free,
        beta_slot_no,
        expires_at,
        views,
        created_at,
        updated_at,
        tp_listing_photos (
          id,
          storage_path,
          sort_order,
          bytes
        ),
        tp_payments (
          id,
          amount_rub,
          status,
          environment,
          payment_kind,
          created_at
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({
      ok: true,
      listings: data || [],
      admin_email: userData.user.email || null,
    });
  }

  if (action === "set_status") {
    const id = String(body.id || "");
    const status = String(body.status || "");

    const allowed = new Set([
      "pending_payment",
      "paid_review",
      "published",
      "hidden",
      "rejected",
      "expired",
    ]);

    if (!id || !allowed.has(status)) {
      return json({ error: "Invalid request" }, 400);
    }

    const { data: current, error: currentError } = await supabase
      .from("tp_listings")
      .select("status, payment_status, is_beta_free, beta_slot_no, expires_at")
      .eq("id", id)
      .single();

    if (currentError) {
      return json({ error: currentError.message }, 500);
    }

    if (status === "published" && current.payment_status !== "paid") {
      return json({
        error: "Нельзя публиковать неоплаченное объявление",
      }, 409);
    }

    const patch: Record<string, unknown> = { status };

    if (status === "published") {
      const expiresAt = current.expires_at
        ? new Date(current.expires_at).getTime()
        : 0;

      // Do not accidentally give another free 30 days by clicking
      // "Publish" on an already active listing.
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        patch.expires_at = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }
    }

    const { data, error } = await supabase
      .from("tp_listings")
      .update(patch)
      .eq("id", id)
      .select("id, public_no, status, payment_status, expires_at")
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ ok: true, listing: data });
  }

  if (action === "delete") {
    const id = String(body.id || "");
    if (!id) {
      return json({ error: "Missing id" }, 400);
    }

    const { data: photos, error: photoError } = await supabase
      .from("tp_listing_photos")
      .select("storage_path")
      .eq("listing_id", id);

    if (photoError) {
      return json({ error: photoError.message }, 500);
    }

    const paths = (photos || [])
      .map((x: any) => x.storage_path)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("listing-photos")
        .remove(paths);

      if (storageError) {
        return json({ error: storageError.message }, 500);
      }
    }

    const { error: deleteError } = await supabase
      .from("tp_listings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    return json({ ok: true });
  }

  if (action === "delete_test_data") {
    const { data: testPayments, error: testError } = await supabase
      .from("tp_payments")
      .select("listing_id")
      .eq("environment", "test")
      .limit(5000);

    if (testError) {
      return json({ error: testError.message }, 500);
    }

    const testListingIds = uniqueStrings(
      (testPayments || []).map((x: any) => x.listing_id),
    );

    if (testListingIds.length === 0) {
      return json({
        ok: true,
        deleted_listings: 0,
        deleted_photos: 0,
      });
    }

    const { data: livePayments, error: liveError } = await supabase
      .from("tp_payments")
      .select("listing_id")
      .in("listing_id", testListingIds)
      .eq("environment", "live")
      .eq("status", "succeeded")
      .limit(5000);

    if (liveError) {
      return json({ error: liveError.message }, 500);
    }

    const protectedIds = new Set(
      (livePayments || []).map((x: any) => String(x.listing_id)),
    );

    const deleteIds = testListingIds.filter(
      (id) => !protectedIds.has(String(id)),
    );

    if (deleteIds.length === 0) {
      return json({
        ok: true,
        deleted_listings: 0,
        deleted_photos: 0,
      });
    }

    const { data: photos, error: photosError } = await supabase
      .from("tp_listing_photos")
      .select("storage_path")
      .in("listing_id", deleteIds)
      .limit(5000);

    if (photosError) {
      return json({ error: photosError.message }, 500);
    }

    const paths = (photos || [])
      .map((x: any) => x.storage_path)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("listing-photos")
        .remove(paths);

      if (storageError) {
        return json({ error: storageError.message }, 500);
      }
    }

    const { error: deleteError } = await supabase
      .from("tp_listings")
      .delete()
      .in("id", deleteIds);

    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    return json({
      ok: true,
      deleted_listings: deleteIds.length,
      deleted_photos: paths.length,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
