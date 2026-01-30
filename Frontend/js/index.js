document.addEventListener("DOMContentLoaded", async () => {
  try {

    const supabase = window.supabaseClient;
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    const userId = session.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("isContractor")
      .eq("id", userId)
      .single();

    if (!profile.isContractor) {
      window.location.href = "html/home.html";
    } else if (profile.isContractor) {
      window.location.href = "html/contractor.html";
    }

  } catch (err) {
    console.error("Auth check failed:", err);
  }
});
