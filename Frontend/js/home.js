document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  
  const {
    data: { session }
  } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = "../html/login.html";
    return;
  }
  
  const userId = session.user.id;
  
  const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("full_name, locality, credits, isContractor")
  .eq("id", userId)
  .single();
  
  
  if (profileError || !profile) {
    document.getElementById("user-info").textContent =
    "Failed to load profile.";
    return;
  }
  
  const userLocality = profile.locality;
  const isContractor = profile.isContractor === true;
  

  document.getElementById("user-info").innerHTML = `
    <strong>Name:</strong> ${profile.full_name}<br/>
    <strong>Locality:</strong> ${userLocality}<br/>
    <strong>Credits:</strong> ${profile.credits}<br/>
    <strong>Role:</strong> ${isContractor ? "Contractor" : "Resident"}
  `;
  
  console.log("USER LOCALITY:", profile.locality);
  await loadProblemCardsForLocality(userLocality);
  
  document.getElementById("logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    
    setTimeout(() => {
      window.location.href = "../index.html";
    }, 100);
  });
});

async function loadProblemCardsForLocality(userLocality) {
  const supabase = window.supabaseClient;
  const container = document.getElementById("cards-container");
  
  container.innerHTML = "Loading problems...";
  
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
    card.className = "problem-card";
    
    card.innerHTML = `
  <img src="${problem.image_url || "https://via.placeholder.com/300x150"}" />
  <div class="card-body">
    <h4>${problem.title}</h4>
    <p>${problem.description}</p>
    <span class="status-badge">${problem.status}</span>
  </div>
`;
    
    card.addEventListener("click", () => {
      window.location.href = `../html/problem.html?problemId=${problem.id}`;
    });
    
    container.appendChild(card);
  });
}
