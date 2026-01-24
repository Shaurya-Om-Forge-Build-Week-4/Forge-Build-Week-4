import { getVotingContract } from "./blockchain.js";

function uuidToChainId(uuid) {
  return BigInt("0x" + uuid.replace(/-/g, "").slice(0, 16)).toString();
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const container = document.getElementById("problems");

  /* ---------------- AUTH CHECK ---------------- */
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Admin login required");
    return;
  }

  /* ---------------- ADMIN WALLET CHECK ---------------- */
  const voting = await getVotingContract();
  const signerAddress = await voting.signer.getAddress();
  const contractAdmin = await voting.admin();

  if (signerAddress.toLowerCase() !== contractAdmin.toLowerCase()) {
    alert("Not admin wallet");
    return;
  }

  document.getElementById("adminInfo").innerText =
    `Admin Wallet: ${signerAddress}`;

  /* ---------------- LOAD PROBLEMS ---------------- */
  const { data: problems } = await supabase
    .from("problems")
    .select("*")
    .order("created_at");

  problems.forEach(p => {
    const chainId = uuidToChainId(p.id);

    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";

    div.innerHTML = `
      <h3>${p.title}</h3>
      <p>Status: ${p.status}</p>

      ${
        p.status === "Initial Voting"
          ? `<button data-action="close-initial" data-id="${chainId}" data-uuid="${p.id}">
               Close Initial Voting
             </button>`
          : ""
      }

      ${
        p.status === "Completion Voting"
          ? `<button data-action="close-completion" data-id="${chainId}" data-uuid="${p.id}">
               Close Completion Voting
             </button>`
          : ""
      }
    `;

    container.appendChild(div);
  });

  /* ---------------- EVENTS ---------------- */
  container.addEventListener("click", async (e) => {
    const btn = e.target;
    if (!btn.dataset.action) return;

    const chainId = btn.dataset.id;
    const uuid = btn.dataset.uuid;

    try {
      if (btn.dataset.action === "close-initial") {
        await voting.closeInitialVoting(chainId);

        await supabase.from("problems").update({
          status: "Under Progress",
          status_code: 2
        }).eq("id", uuid);
      }

      if (btn.dataset.action === "close-completion") {
        await voting.closeCompletionVoting(chainId);

        const phase = await voting.getPhase(chainId);
        const finalStatus =
          Number(phase) === 3 ? "Completed" : "Failed";

        await supabase.from("problems").update({
          status: finalStatus,
          status_code: finalStatus === "Completed" ? 4 : 5
        }).eq("id", uuid);
      }

      alert("Action successful");
      location.reload();
    } catch (err) {
      console.error(err);
      alert("Blockchain action failed");
    }
  });
});
