import { getVotingContract } from "./blockchain.js";

export async function castVote(problemId, votes) {
  const voting = await getVotingContract();
  const tx = await voting.vote(Number(problemId), Number(votes));
  await tx.wait();
}
