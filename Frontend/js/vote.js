import { getVotingContract } from "./blockchain.js";

export async function castVote(chainProblemId, votes) {
  const voting = await getVotingContract();
  const tx = await voting.vote(chainProblemId, votes);
  await tx.wait();
}
