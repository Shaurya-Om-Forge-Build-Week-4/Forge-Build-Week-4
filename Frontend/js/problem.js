import { castVote } from "../js/vote.js";
import { voteCompletion } from "../js/completionVote.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Problem JS loaded");
  
  const SUPABASE_URL = "https://boocborspzmgivjqrahr.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_LB3wTXMuOHWjK8n5tGA6LQ_pnWwplGP";
  
  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
  
  const params = new URLSearchParams(window.location.search);
  const problemId = params.get("problemId");
  
  if (!problemId) {
    console.error("Problem ID missing");
    return;
  }
  
  loadProblem();
  
  async function loadProblem() {
    const { data: problem, error } = await supabase
    .from("problems")
    .select("*")
    .eq("id", problemId)
    .single();
    
    if (error || !problem) {
      console.error(error);
      return;
    }
    
    populateUI(problem);
  }
  
  function populateUI(p) {
    // IMAGE
    if (p.image_url) {
      const img = document.getElementById("problemImage");
      img.src = p.image_url;
      img.hidden = false;
    }
    
    document.getElementById("problemTitle").innerText = p.id;
    document.getElementById("description").innerText = p.description;
    document.getElementById("status").innerText = `Status: ${p.status}`;
    document.getElementById("locality").innerText = p.locality;
    document.getElementById("cost").innerText = `Cost: ₹${p.cost}`;
    
    // ---------------- INITIAL VOTING ----------------
    if (p.status_code === 1) {
      document.getElementById("votingSection").hidden = false;
      document.getElementById("voteBtn").hidden = false;
      
      document.getElementById("voteBtn").onclick = async () => {
        const votes = Number(
          document.getElementById("voteInput").value
        );
        
        
        if (!votes || votes <= 0) {
          alert("Enter valid votes"); 
          return;
        }
        
        const cost = votes * votes;
        
        if (!confirm(`This will cost ${cost} credits. Proceed?`)) {
          return;
        }
        
        try {
          // 🔗 BLOCKCHAIN (source of truth)
          await castVote(problemId, votes);
          
          const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();
          
          if (profile.credits < cost) {
            alert("Insufficient credits");
            return;
          }
          
          alert("Vote submitted successfully");
          
        } catch (err) {
          console.error(err);
          alert("Transaction failed or insufficient credits");
        }
      };
    }
    
    // ---------------- COMPLETION VOTING ----------------
    if (p.status_code === 3) {
      document.getElementById("completionVoting").hidden = false;
      
      document.getElementById("yesBtn").onclick = async () => {
        await handleCompletionVote(true);
      };
      
      document.getElementById("noBtn").onclick = async () => {
        await handleCompletionVote(false);
      };
    }
  }
  
  async function handleCompletionVote(solved) {
    try {
      await voteCompletion(problemId, solved);
      alert("Vote recorded");
    } catch (err) {
      console.error(err);
      alert("Transaction failed");
    }
  }
});
