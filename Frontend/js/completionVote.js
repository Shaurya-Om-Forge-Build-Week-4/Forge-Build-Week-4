import { getVotingContract } from "./blockchain.js";

export async function voteCompletion(chainProblemId, solved) {
  const voting = await getVotingContract();
  const tx = await voting.voteCompletion(chainProblemId, solved);
  await tx.wait();
}

