import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getVotingContract } from "./blockchain.js";

export async function castVote(problemId, votes) {
  const voting = await getVotingContract();

  const chainProblemId = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(problemId)
  );

  console.log("CHAIN PROBLEM ID:", chainProblemId);

  const tx = await voting.vote(chainProblemId, votes);
  await tx.wait();
}
