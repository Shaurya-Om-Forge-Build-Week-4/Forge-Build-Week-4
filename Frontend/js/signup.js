console.log("signup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;

  const form = document.getElementById("signup-form");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const full_name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const locality = document.getElementById("locality").value;

      const userType = document.querySelector(
        'input[name="user_type"]:checked'
      )?.value;

      if (!full_name || !email || !password || !locality || !userType) {
        throw new Error("All fields are required");
      }

      message.textContent = "Creating account...";

      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error("Signup failed");

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          full_name,
          locality,
          credits: 100,
          isContractor: userType === "contractor"
        });

      if (profileError) throw profileError;

      message.textContent = "Signup successful!";
      message.style.color = "green";

      setTimeout(() => {
        window.location.href = "../html/index.html";
      }, 1000);

    } catch (err) {
      console.error(err);
      message.textContent = err.message || "Signup failed";
      message.style.color = "red";
    }
  });
});
