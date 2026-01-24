import { getVotingContract } from "./blockchain.js";

export async function voteCompletion(problemId, solved) {
  const voting = await getVotingContract();
  const tx = await voting.voteCompletion(Number(problemId), solved);
  await tx.wait();
}
