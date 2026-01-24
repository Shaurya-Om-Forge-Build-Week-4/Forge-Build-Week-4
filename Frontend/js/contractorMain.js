import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getVotingContract } from "./blockchain.js";

function toChainId(uuid) {
  return ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(uuid)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const container = document.getElementById("problemsContainer");
  
  /* ---------------- AUTH ---------------- */
  const {
    data: { session }
  } = await supabase.auth.getSession();
  
  if (!session) {
    window.location.href = "../html/login.html";
    return;
  }
  
  const userId = session.user.id;
  
  /* ---------------- CONTRACTOR CHECK ---------------- */
  const { data: profile } = await supabase
  .from("profiles")
  .select("locality, isContractor")
  .eq("id", userId)
  .single();
  
  if (!profile || !profile.isContractor) {
    window.location.href = "../html/home.html";
    return;
  }
  
  document.getElementById("localityBadge").innerText =
    `Locality: ${profile.locality}`;
  
  /* ---------------- LOAD PROBLEMS ---------------- */
  const { data: problems } = await supabase
  .from("problems")
  .select("*")
  .eq("locality", profile.locality)
  .eq("status_code", 2)
  .order("status_code");
  
  if (!problems || problems.length === 0) {
    container.innerHTML = "<p>No assigned problems.</p>";
    return;
  }
  
  container.innerHTML = "";
  
  problems.forEach((p) => {
    const card = document.createElement("div");
    card.className = "problem-card";
    
    card.innerHTML = `
      <h3>${p.title}</h3>
      <img src="${p.image_url || "https://via.placeholder.com/300x150"}" />
      <p>${p.assigned ? `<p><strong>Advance Paid:</strong> ₹${p.advance_paid}</p>` : ""}</p>
      <p><strong>Status:</strong> ${p.status}</p>
      <p><strong>Sector:</strong> ${p.locality}</p>
    
      <textarea
        id="remark-${p.id}"
        placeholder="Add work update..."
      >${p.remark || ""}</textarea>
    
      <button class="save-btn" data-id="${p.id}">
        Save Remark
      </button>
    
      ${
        p.status === "Under Progress"
          ? `<button class="complete-btn" data-id="${p.id}">
               Mark Work Completed
             </button>`
          : ""
      }
    `;
    
    container.appendChild(card);
  });
  
  /* ---------------- EVENTS ---------------- */
  container.addEventListener("click", async (e) => {
    const saveBtn = e.target.closest(".save-btn");
    const completeBtn = e.target.closest(".complete-btn");
    
    /* SAVE REMARK */
    if (saveBtn) {
      const id = saveBtn.dataset.id;
      const remark = document
      .getElementById(`remark-${id}`)
      .value.trim();
      
      if (!remark) return alert("Remark empty");
      
      await supabase
      .from("problems")
      .update({ remark })
      .eq("id", id);
      
      alert("Remark saved");
    }
    
    /* MARK COMPLETED (DB ONLY) */
    /* MARK COMPLETED */
    if (completeBtn) {
      const id = completeBtn.dataset.id;
      if (!confirm("Mark work as completed and start completion voting?")) return;
      
      const chainProblemId = toChainId(id);
      const voting = await getVotingContract();
      
      try {
        // 1️⃣ START COMPLETION VOTING ON-CHAIN
        const tx = await voting.startCompletionVoting(chainProblemId);
        await tx.wait();
        
        // 2️⃣ UPDATE DATABASE (UI STATE)
        await supabase
        .from("problems")
        .update({
          status: "Completion Voting",
          status_code: 3
        })
        .eq("id", id);
        
        alert("Completion voting started");
        location.reload();
        
      } catch (err) {
        console.error(err);
        alert("Blockchain transaction failed");
      }
    }
    
  });
  
  /* ---------------- LOGOUT ---------------- */
  document.getElementById("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "../html/login.html";
  };
});
