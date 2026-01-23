import { getContracts } from "./blockchain.js";

export async function castVote(problemId, votes) {
  const { voting } = await getContracts();
  const tx = await voting.voteQuadratic(problemId, votes);
  await tx.wait();
}
