import { getContracts } from "./blockchain.js";

export async function getTotalVotes(problemId) {
  const { voting } = await getContracts();
  return Number(await voting.getTotalVotes(problemId));
}

export async function getMyVotes(problemId) {
  const { voting, signer } = await getContracts();
  const user = await signer.getAddress();
  return Number(await voting.getUserVotes(user, problemId));
}

export async function getMyCredits() {
  const { voting, signer } = await getContracts();
  const user = await signer.getAddress();
  return Number(await voting.credits(user));
}
