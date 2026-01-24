import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { castVote } from "../js/vote.js";
import { voteCompletion } from "../js/completionVote.js";
import { getVotingContract } from "../js/blockchain.js";

function toChainId(uuid) {
  return ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(uuid)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) return;
  
  /* ---------------- AUTH ---------------- */
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../html/login.html";
    return;
  }
  
  /* ---------------- FETCH PROBLEM ---------------- */
  const params = new URLSearchParams(window.location.search);
  const problemUUID = params.get("problemId");
  if (!problemUUID) return;
  
  const chainProblemId = toChainId(problemUUID);
  
  const { data: p, error } = await supabase
  .from("problems")
  .select("*")
  .eq("id", problemUUID)
  .single();
  
  if (error || !p) {
    console.error(error);
    return;
  }
  
  /* ---------------- UI STATIC ---------------- */
  document.getElementById("problemTitle").innerText = p.title;
  document.getElementById("description").innerText = p.description;
  document.getElementById("status").innerText = p.status;
  document.getElementById("locality").innerText = p.locality;
  document.getElementById("cost").innerText = `Estimated Cost: ₹${p.cost}`;
  document.getElementById("chainProblemId").innerText = chainProblemId;
  
  if (p.image_url) {
    const img = document.getElementById("problemImage");
    img.src = p.image_url;
    img.hidden = false;
  }
  
  /* ---------------- BLOCKCHAIN READS ---------------- */
  const voting = await getVotingContract();
  const userAddress = await voting.signer.getAddress();
  
  async function refreshStats() {
    const totalVotes = await voting.getTotalVotes(chainProblemId);
    const myVotes = await voting.getUserVotes(userAddress, chainProblemId);
    let credits = await voting.credits(userAddress);
    const [yes, no] = await voting.getCompletionVotes(chainProblemId);
    
    // UX fix for first-time users
    if (credits.toString() === "0") {
      credits = 100;
    }
    
    document.getElementById("chainTotalVotes").innerText =
      `Total Votes: ${totalVotes}`;
    
    document.getElementById("myVotes").innerText =
      `Your Votes: ${myVotes}`;
    
    document.getElementById("myCredits").innerText =
      `Credits Left: ${credits}`;
    
    if (p.status_code === 3) {
      document.getElementById("completionStats").innerText =
      `Completion Votes → Yes: ${yes} | No: ${no}`;
    }
  }
  
  await refreshStats();
  
  /* ---------------- INITIAL VOTING ---------------- */
  if (p.status_code === 1) {
    const section = document.getElementById("votingSection");
    section.hidden = false;
    
    const voteInput = document.getElementById("voteInput");
    const costPreview = document.getElementById("voteCostPreview");
    
    voteInput.addEventListener("input", () => {
      const v = Number(voteInput.value);
      costPreview.innerText =
      v > 0 ? `Cost: ${v*(v+1)*(2*v+1)/6} credits` : "";
    });
    
    document.getElementById("voteBtn").onclick = async () => {
      const votes = Number(voteInput.value);
      if (votes <= 0) return alert("Invalid votes");
      
      try {
        await castVote(chainProblemId, votes);
        await refreshStats();
        voteInput.value = "";
        costPreview.innerText = "";
        alert("Vote recorded on blockchain");
      } catch (err) {
        console.error(err);
        alert("Transaction failed");
      }
    };
  }
  
  /* ---------------- COMPLETION VOTING ---------------- */
  if (p.status_code === 3) {
    const section = document.getElementById("completionVoting");
    section.hidden = false;
    
    document.getElementById("yesBtn").onclick = async () => {
      await voteCompletion(chainProblemId, true);
      await refreshStats();
      alert("Vote recorded");
    };
    
    document.getElementById("noBtn").onclick = async () => {
      await voteCompletion(chainProblemId, false);
      await refreshStats();
      alert("Vote recorded");
    };
  }
});
