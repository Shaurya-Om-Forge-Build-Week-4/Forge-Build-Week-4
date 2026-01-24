import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getVotingContract } from "../js/blockchain.js";

function toChainId(uuid) {
  return ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(uuid)
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const container = document.getElementById("problems");

  /* ---------- AUTH ---------- */
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

      ${p.status_code === 0 ? `<button data-act="register">Register & Open Voting</button>` : ""}
      ${p.status_code === 1 ? `<button data-act="closeInitial">Close Initial Voting</button>` : ""}
      ${p.status_code === 3 ? `<button data-act="closeCompletion">Close Completion Voting</button>` : ""}
    `;

    div.onclick = async (e) => {
      const act = e.target.dataset.act;
      if (!act) return;

      try {
        /* REGISTER */
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

        /* CLOSE INITIAL */
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

        /* CLOSE COMPLETION */
        if (act === "closeCompletion") {
          const tx = await voting.closeCompletionVoting(chainId);
          await tx.wait();

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
