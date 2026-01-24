import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.min.js";
import { getVotingContract } from "./blockchain.js";

export async function voteCompletion(problemId, solved) {
  const voting = await getVotingContract();

  const chainProblemId = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(problemId)
  );

  const tx = await voting.voteCompletion(chainProblemId, solved);
  await tx.wait();
}
