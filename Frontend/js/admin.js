import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getVotingContract } from "../js/blockchain.js";
import { TREASURY_ADDRESS } from "../js/config.js";
import treasuryABI from "./TreasuryABI.js";



function toChainId(uuid) {
  return ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(uuid)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const container = document.getElementById("problems");
  
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  
  
  document.getElementById("startAll").onclick = async () => {
    await supabase.from("problems").update({
      status: "Initial Voting",
      status_code: 1
    }).eq("status_code", 0);
    
    alert("Initial voting started");
    location.reload();
  };
  
  
  document.getElementById("closeAll").onclick = async () => {
    const voting = await getVotingContract();
    
    const { data: problems } = await supabase
    .from("problems")
    .select("*")
    .eq("status_code", 1);
    
    const byLocality = {};
    problems.forEach(p => {
      if (!byLocality[p.locality]) byLocality[p.locality] = [];
      byLocality[p.locality].push(p);
    });
    
    for (const locality in byLocality) {
      let winner = null;
      let maxVotes = -1;
      
      for (const p of byLocality[locality]) {
        const votes = await voting.getTotalVotes(toChainId(p.id));
        if (votes > maxVotes) {
          maxVotes = votes;
          winner = p;
        }
      }
      
      for (const p of byLocality[locality]) {
        await supabase.from("problems").update({
          status: "Draft",
          status_code: 0,
          assigned: false
        }).eq("id", p.id);
      }
      
      if (!winner) continue;
      
      await supabase.from("problems").update({
        status: "Under Progress",
        status_code: 2,
        assigned: true
      }).eq("id", winner.id);
      
      const { data: contractor, error } = await supabase
      .from("profiles")
      .select("wallet")
      .eq("locality", locality)
      .eq("isContractor", true)
      .maybeSingle();
      
      if (error) {
        console.error("Contractor query error:", error);
        continue;
      }
      
      
      if (!contractor?.wallet) {
        console.warn(`No contractor wallet for ${locality}`);
        continue;
      }
      
      const treasury = new ethers.Contract(
        TREASURY_ADDRESS,
        treasuryABI,
        signer
      );
      
      await voting.moveToUnderProgress(toChainId(p.id));
      await treasury.createEscrow(
        toChainId(winner.id),
        contractor.wallet,
        {
          value: ethers.utils.parseEther("0.0002")

        }
      );
      
      await supabase.from("problems").update({
        advance_paid: winner.cost * 0.5,
        escrow_created: true
      }).eq("id", winner.id);
    }
    
    alert("Initial voting closed, winners selected, escrow funded");
    location.reload();
  };
  
  
  document.getElementById("resetAll").onclick = async () => {
    const { data: problems } = await supabase
    .from("problems")
    .select("id");
    
    for (const p of problems) {
      await supabase.from("problems").update({
        status: "Draft",
        status_code: 0,
        assigned: false,
        advance_paid: 0
      }).eq("id", p.id);
    }
    
    alert("System reset to draft");
    location.reload();
  };
  
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Login required");
    return;
  }
  
  /* ---------- LOAD ALL PROBLEMS (ADMIN) ---------- */
  const { data: problems, error } = await supabase
  .from("problems")
  .select("*")
  .order("status_code");
  
  if (error) {
    console.error(error);
    container.innerText = "Failed to load problems";
    return;
  }
  
  const voting = await getVotingContract();
  container.innerHTML = "";
  
  problems.forEach((p) => {
    const chainId = toChainId(p.id);
    
    const div = document.createElement("div");
    div.className = "problem";
    
    div.innerHTML = `
      <h3>${p.title}</h3>
      <p><strong>Locality:</strong> ${p.locality}</p>
      <p><strong>Status:</strong> ${p.status}</p>
      ${p.status_code === 3 ? `<button data-act="closeCompletion">Close Completion Voting</button>` : ""}
    `;
    
    
    div.onclick = async (e) => {
      const act = e.target.dataset.act;
      if (!act) return;
      
      try {

        if (act === "register") {
          const tx = await voting.vote(chainId, 1);
          await tx.wait();
          
          await supabase.from("problems").update({
            status: "Initial Voting",
            status_code: 1
          }).eq("id", p.id);
          
          alert("Initial voting opened");
          location.reload();
        }
        
        if (act === "closeInitial") {
          const tx = await voting.moveToUnderProgress(chainId);
          await tx.wait();
          
          await supabase.from("problems").update({
            status: "Under Progress",
            status_code: 2
          }).eq("id", p.id);
          
          alert("Moved to Under Progress");
          location.reload();
        }
        
        if (act === "closeCompletion") {
          const tx = await voting.closeCompletionVoting(chainId);
          await tx.wait();
          
          const treasury = new ethers.Contract(
            TREASURY_ADDRESS,
            treasuryABI,
            signer
          );
          
          
          await treasury.finalize(chainId);
          
          const phase = await voting.getPhase(chainId);
          
          const final =
          phase === 3
          ? { status: "Completed", status_code: 4 }
          : { status: "Failed", status_code: 5 };
          
          await supabase.from("problems").update(final).eq("id", p.id);
          
          alert("Completion voting closed");
          location.reload();
        }
        
      } catch (err) {
        console.error(err);
        alert("Blockchain action failed");
      }
    };
    
    container.appendChild(div);
  });
});
