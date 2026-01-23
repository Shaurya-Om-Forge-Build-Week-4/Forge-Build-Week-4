document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  // ==========================
  // 1️⃣ Session Check (Protected Page)
  // ==========================
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "../html/login.html";
    return;
  }

  // ==========================
  // 2️⃣ Fetch User Profile
  // ==========================
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, locality, credits, isContractor")
    .single();

  if (profileError || !profile) {
    document.getElementById("user-info").textContent =
      "Failed to load profile.";
    return;
  }

  const userLocality = profile.locality;
  const isContractor = profile.isContractor === true;

  // ==========================
  // 3️⃣ Render User Info
  // ==========================
  document.getElementById("user-info").innerHTML = `
    <strong>Name:</strong> ${profile.full_name}<br/>
    <strong>Locality:</strong> ${userLocality}<br/>
    <strong>Credits:</strong> ${profile.credits}<br/>
    <strong>Role:</strong> ${isContractor ? "Contractor" : "Resident"}
  `;

  // ==========================
  // 4️⃣ Contractor Dashboard Button
  // ==========================
  // if (isContractor) {
  //   const contractorBtn = document.getElementById("contractor-btn");
  //   contractorBtn.style.display = "block";

  //   contractorBtn.addEventListener("click", () => {
  //     window.location.href = "../html/signup.html";
  //   });
  // }

  // ==========================
  // 5️⃣ Load Problems (LOCALITY-RESTRICTED)
  // ==========================
  console.log("USER LOCALITY:", profile.locality);
  await loadProblemCardsForLocality(userLocality);

  // ==========================
  // 6️⃣ Logout
  // ==========================
  document.getElementById("logout").addEventListener("click", async () => {
    await supabase.auth.signOut();

    setTimeout(() => {
      window.location.href = "../html/login.html";
    }, 100);
  });
});


// ===================================================
// Fetch & render problems ONLY from user's locality
// ===================================================
async function loadProblemCardsForLocality(userLocality) {
  const supabase = window.supabaseClient;
  const container = document.getElementById("cards-container");

  container.innerHTML = "Loading problems...";

  // 🔐 HARD LOCALITY FILTER
  const { data, error } = await supabase
    .from("problems")
    .select("id, title, description, image_url, status, locality, status_code")
    .eq("locality", userLocality.trim())
    .order("status_code");

  if (error) {
    console.error(error);
    container.innerHTML = "Error loading problems.";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML =
      "No problems reported in your locality yet.";
    return;
  }

  container.innerHTML = "";

  data.forEach((problem) => {
    const card = document.createElement("div");

    card.style.cssText = `
      border: 1px solid #ccc;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    `;

    card.innerHTML = `
      <img
        src="${problem.image_url || "https://via.placeholder.com/300x150"}"
        style="width:100%; height:120px; object-fit:cover;"
      />
      <div style="padding:10px;">
        <h4 style="margin:0 0 5px 0;">${problem.title}</h4>
        <p style="font-size:13px; margin:0 0 10px 0;">
          ${problem.description}
        </p>
        <button
          style="
            font-size: 12px;
            padding: 5px 8px;
            background: #e5e7eb;
            border: none;
            border-radius: 4px;
          "
        >
          ${problem.status}
        </button>
      </div>
    `;

    // Navigate to details page (future)
    card.addEventListener("click", () => {
    window.location.href = `../html/problem.html?problemId=${problem.id}`;
    });

    container.appendChild(card);
  });
}
