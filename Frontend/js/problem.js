import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { castVote } from "../js/vote.js";
import { voteCompletion } from "../js/completionVote.js";
import { getVotingContract } from "../js/blockchain.js";

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  // Auth check
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../html/login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const problemUUID = params.get("problemId");
  if (!problemUUID) return;

  // 🔗 Deterministic on-chain ID
  const chainProblemId = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(problemUUID)
  );

  // Fetch problem (off-chain metadata)
  const { data: p, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", problemUUID)
    .single();

  if (error || !p) {
    console.error(error);
    return;
  }

  // UI — static data
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

  // 🔗 Blockchain reads
  const voting = await getVotingContract();
  const userAddress = await voting.signer.getAddress();

  async function refreshChainStats() {
    const totalVotes = await voting.getTotalVotes(chainProblemId);
    const myVotes = await voting.getUserVotes(userAddress, chainProblemId);
    const myCredits = await voting.credits(userAddress);

    document.getElementById(
      "chainTotalVotes"
    ).innerText = `Total Votes (on-chain): ${totalVotes}`;

    document.getElementById(
      "myVotes"
    ).innerText = `Your Votes: ${myVotes}`;

    document.getElementById(
      "myCredits"
    ).innerText = `Your Credits: ${myCredits}`;
  }

  await refreshChainStats();

  // ---------------- INITIAL VOTING ----------------
  if (p.status === "Initial Voting") {
    const votingSection = document.getElementById("votingSection");
    votingSection.hidden = false;

    const voteInput = document.getElementById("voteInput");
    const costPreview = document.getElementById("voteCostPreview");

    voteInput.addEventListener("input", () => {
      const v = Number(voteInput.value);
      if (v > 0) {
        costPreview.innerText = `Cost: ${v * v} credits`;
      } else {
        costPreview.innerText = "";
      }
    });

    document.getElementById("voteBtn").onclick = async () => {
      const votes = Number(voteInput.value);
      if (!votes || votes <= 0) {
        alert("Enter a valid number of votes");
        return;
      }

      const cost = votes * votes;
      if (!confirm(`This will cost ${cost} credits. Proceed?`)) return;

      try {
        await castVote(problemUUID, votes);
        await refreshChainStats();
        alert("Vote successfully recorded on blockchain");
        voteInput.value = "";
        costPreview.innerText = "";
      } catch (err) {
        console.error(err);
        alert("Transaction failed");
      }
    };
  }

  // ---------------- COMPLETION VOTING ----------------
  if (p.status === "Completion Voting") {
    const section = document.getElementById("completionVoting");
    section.hidden = false;

    document.getElementById("yesBtn").onclick = async () => {
      await voteCompletion(problemUUID, true);
      alert("Vote recorded");
    };

    document.getElementById("noBtn").onclick = async () => {
      await voteCompletion(problemUUID, false);
      alert("Vote recorded");
    };
  }
});
