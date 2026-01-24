import { getVotingContract } from "./blockchain.js";

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const container = document.getElementById("problemsContainer");

  try {
    /* =========================
       1. SESSION CHECK
    ========================= */

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      window.location.href = "../html/login.html";
      return;
    }

    const userId = session.user.id;

    /* =========================
       2. FETCH CONTRACTOR LOCALITY
    ========================= */

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("locality, isContractor")
      .eq("id", userId)
      .single();

    if (profileError || !profile || !profile.isContractor) {
      window.location.href = "../html/home.html";
      return;
    }

    const locality = profile.locality;

    /* =========================
       3. FETCH PROBLEMS
    ========================= */

    const { data: problems, error: problemsError } = await supabase
      .from("problems")
      .select("*")
      .eq("locality", locality)
      .order("status_code");

    if (problemsError) {
      console.error("Problems fetch error:", problemsError);
      return;
    }

    if (!problems || problems.length === 0) {
      container.innerHTML = "<p>No problems assigned to your locality.</p>";
      return;
    }

    container.innerHTML = "";

    problems.forEach((problem) => {
      const card = document.createElement("div");
      card.className = "problem-card";
      card.dataset.problemId = problem.id;
      card.dataset.status = problem.status;

      card.innerHTML = `
        <p><strong>Title:</strong> ${problem.title}</p>
        <p><strong>Status:</strong> ${problem.status}</p>

        ${problem.start_date ? `<p><strong>Start:</strong> ${problem.start_date}</p>` : ""}
        ${problem.end_date ? `<p><strong>End:</strong> ${problem.end_date}</p>` : ""}
        ${problem.funds_allocated > 0 ? `<p><strong>Funds:</strong> &#8377;${problem.funds_allocated}</p>` : ""}

        <textarea
          class="remark-input"
          id="remark-${problem.id}"
          placeholder="Add remark..."
          ${problem.status_code === 3 ? "disabled" : ""}>${problem.remark || ""}</textarea>

        <button class="save-btn" >
          Save Remark
        </button>
        </button>

        <button class="complete-btn" >
          Mark Completed
        </button>
      `;

      container.appendChild(card);
    });

    /* =========================
       4. EVENT DELEGATION
    ========================= */

    container.addEventListener("click", async (e) => {
      const card = e.target.closest(".problem-card");
      if (!card) return;

      const problemId = card.dataset.problemId;
      const status = Number(card.dataset.status);

      // SAVE REMARK
      if (e.target.classList.contains("save-btn")) {
        const remarkEl = card.querySelector(".remark-input");
        const remark = remarkEl.value.trim();

        if (!remark) {
          alert("Remark cannot be empty");
          return;
        }

        const { error } = await supabase
          .from("problems")
          .update({ remark })
          .eq("id", problemId);

        if (error) {
          console.error("Remark update error:", error);
          alert("Failed to save remark");
        } else {
          alert("Remark saved ✅");
        }
      }

      // MARK COMPLETED
      if (e.target.classList.contains("complete-btn")) {
        if (!confirm("Mark this problem as completed?")) return;

        const { error } = await supabase
          .from("problems")
          .update({ status_code: 3 })
          .eq("id", problemId);

        if (error) {
          console.error("Status update error:", error);
          alert("Failed to update status");
        } else {
          alert("Problem marked as completed ✅");
          location.reload();
        }

        const { voting } = await getVotingContract();

        try {
          // 🔗 BLOCKCHAIN
          await voting.moveToCompletionVoting(problemId);

          alert("Problem moved to completion voting");
          location.reload();
        } catch (err) {
          console.error(err);
          alert("Blockchain transaction failed");
        }
      }
    });
  } catch (err) {
    console.error("Contractor dashboard error:", err);
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();

    setTimeout(() => {
      window.location.href = "../html/login.html";
    }, 100);
  });
});

/* =========================
   STATUS HELPER
========================= */

function statusText(code) {
  if (code === 1) return "Open";
  if (code === 2) return "In Progress";
  if (code === 3) return "Completed";
  return "Unknown";
}
