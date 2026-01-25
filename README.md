# Proof Of Fix – Decentralized Civic Accountability, One Neighbourhood at A Time

## Overview

Proof Of Fix is a dApp that identifies helps citizens vote on which problems matter most, and fund their solution in a transparent way using blockchain.

The project combines **Public Goods governance** and **DeFi concepts**. Public goods are handled through community voting, and DeFi is used through an **escrow-based funding system** that releases money only when work is approved.

The goal is to make public spending more transparent, fair, and community-driven.

---

## Main Idea

In real life, public issues like broken roads, damaged streetlights, or water leaks are often ignored or solved without transparency. Proof Of Fix fixes this by:

- Letting citizens vote on problems  
- Selecting the most important problem per locality  
- Assigning a contractor  
- Locking funds in a smart contract escrow  
- Releasing funds only after work completion is approved by citizens  

Everything important is verifiable on-chain.

---

## Core Themes

### 1. Public Goods

- Problems affect everyone in a locality  
- Citizens vote using **quadratic voting** to keep influence fair  
- More support means higher priority  
- Completion is approved again by citizens  

This ensures the system is community-driven.

### 2. DeFi (Decentralized Finance)

- Funds are locked in an **escrow smart contract**  
- Contractor receives only an advance initially  
- Remaining funds are released only if completion voting passes  
- If work fails, funds stay in the treasury  

This removes blind trust and reduces misuse of funds.

---

![Decsion Path Flow Chart]("DecsionPath.png")


## Voting System

### Initial Voting (Quadratic Voting)

- Each user has limited credits  
- Cost of votes increases quadratically  
- Voting multiple times costs more  
- Prevents vote spamming  

### Completion Voting

- Simple Yes / No voting  
- No credits required  
- One vote per wallet  
- Majority decides the result  

---

## Smart Contracts

### Voting.sol

Handles:
- Problem lifecycle states  
- Quadratic voting logic  
- Completion approval voting  
- Vote tracking per user  
- On-chain problem status  

### Treasury.sol

Handles:
- Central treasury  
- Escrow creation  
- Advance payment to contractor  
- Final payment after successful completion  
- Fund retention if work fails  

---

## Tech Stack

### Frontend
- HTML, CSS, JavaScript  
- Ethers.js for blockchain interaction  

### Backend
- Supabase (Authentication + Database)  

### Blockchain
- Solidity smart contracts  
- Deployed on Sepolia testnet  
- MetaMask wallet integration  

---

## Workflow

1. Citizen reports a problem  
2. Admin starts initial voting  
3. Citizens vote using credits  
4. Admin closes voting  
5. Winning problem moves to *Under Progress*  
6. Escrow is created and advance is paid  
7. Contractor completes work  
8. Completion voting starts  
9. Citizens approve or reject  
10. Funds are released or retained  

---

## Why This Project Matters

- Makes public spending transparent  
- Reduces corruption risks  
- Gives citizens real decision power  
- Uses blockchain where it adds real value  
- Combines governance and finance in a practical way  

