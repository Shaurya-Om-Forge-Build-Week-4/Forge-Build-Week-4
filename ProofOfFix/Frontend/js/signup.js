console.log("signup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;

  const form = document.getElementById("signup-form");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const full_name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const locality = document.getElementById("locality").value;

    // ✅ Validation
    if (!full_name || !email || !password || !locality) {
      message.textContent = "All fields are required.";
      message.style.color = "red";
      return;
    }

    message.textContent = "Submitting...";
    message.style.color = "black";

    // 1️⃣ Signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      message.textContent = error.message;
      message.style.color = "red";
      return;
    }

    const user = data.user;
    if (!user) {
      message.textContent = "Signup failed.";
      message.style.color = "red";
      return;
    }

    const userType = document.querySelector(
  'input[name="user_type"]:checked'
).value;

// flag1 = contractor
const Contractor = userType === "contractor";

    // 2️⃣ Create profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name,
        locality,
        credits: 0,
        isContractor: Contractor, // ✅ contractor = true
    flag2: false,
    flag3: false,
    flag4: false,
    flag5: false,
    flag6: false,
    flag7: false,
    flag8: false,
    flag9: false,
    flag10: false
      });

    if (profileError) {
      message.textContent = profileError.message;
      message.style.color = "red";
      return;
    }

    // ✅ Redirect ONLY after successful signup
    message.textContent = "Signup successful! Redirecting...";
    message.style.color = "green";

    setTimeout(() => {
      window.location.href = "../html/index.html";
    }, 1000);
  });
});
