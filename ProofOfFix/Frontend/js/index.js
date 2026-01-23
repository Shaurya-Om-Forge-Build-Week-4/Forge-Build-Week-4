document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. Check auth session
    const supabase = window.supabaseClient;
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      // ❌ Not logged in
      window.location.href = "../html/login.html";
      return;
    }

    const userId = session.user.id;

    // 2. Fetch user role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("isContractor")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      window.location.href = "../html/login.html";
      return;
    }

    // 3. Redirect based on role
    if (!profile.isContractor) {
      window.location.href = "../html/home.html";
    } else if (profile.isContractor) {
      window.location.href = "../html/contractor.html";
    } else {
      // Unknown role → force re-login
      window.location.href = "../html/login.html";
    }

  } catch (err) {
    console.error("Auth check failed:", err);
    // window.location.href = "../html/login.html";
  }
});
