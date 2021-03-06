import { log } from '@graphprotocol/graph-ts'
import { ApprovalForAll, Transfer } from '../../generated/PositionNFT/PositionNFT'
import { getOrInitNft, getOrInitContract, getOrInitNftDayData, getOrInitNftStatistics, getOrInitOwner, initTransaction } from '../helpers/initializers'
import { ONE_BI } from '../utils/constant'
import { getContractName, getGradeOfNft, getNftStatus, getNftTransferAction } from '../utils/getData'

export function handleTransfer(event: Transfer): void {
  let nft = getOrInitNft(event.params.tokenId.toString(), event)

  let from = getOrInitOwner(event.params.from.toHexString(), event)
  let to = getOrInitOwner(event.params.to.toHexString(), event)
  let nftStatistics = getOrInitNftStatistics(event)
  let nftDayData = getOrInitNftDayData(event)

  let action = getNftTransferAction(from.id, to.id)

  // Mint
  if (action == 'Mint') {
    nftStatistics.totalNftsMinted = nftStatistics.totalNftsMinted.plus(ONE_BI)
    nftDayData.dailyNftMinted = nftDayData.dailyNftMinted.plus(ONE_BI)
  }

  // Burn
  if (action == 'Burn') {
    nft.burned = true
    from.totalNftsBurned = from.totalNftsBurned.plus(ONE_BI)
    nftStatistics.totalNftsBurned = nftStatistics.totalNftsBurned.plus(ONE_BI)
    nftDayData.dailyNftBurned = nftDayData.dailyNftBurned.plus(ONE_BI)
  }

  // Stake
  if (action == 'Stake') {
    from.totalNftsStaking = from.totalNftsStaking.plus(ONE_BI)
    nftStatistics.totalNftsStaking = nftStatistics.totalNftsStaking.plus(ONE_BI)
  }

  // Unstake
  if (action == 'Unstake') {
    from.totalNftsStaking = from.totalNftsStaking.minus(ONE_BI)
    nftStatistics.totalNftsStaking = nftStatistics.totalNftsStaking.minus(ONE_BI)
  }

  // Normal transfer
  from.totalNfts =
    action == 'Mint'
    || action == 'Stake'
    || action == 'Unstake'
      ? from.totalNfts
      : from.totalNfts.minus(ONE_BI)
  from.totalTransactions = from.totalTransactions.plus(ONE_BI)
  to.totalNfts =
    action == 'Stake'
    || action == 'Unstake'
      ? to.totalNfts
      : to.totalNfts.plus(ONE_BI)
  to.totalTransactions = to.totalTransactions.plus(ONE_BI)

  // Update current owner
  if (action != 'Stake') {
    nft.owner = to.id
  }
  nft.status = getNftStatus(from.id, to.id)
  nft.totalTransactions = nft.totalTransactions.plus(ONE_BI)
  nft.updatedTimestamp = event.block.timestamp

  nftStatistics.totalTransactions = nftStatistics.totalTransactions.plus(ONE_BI)
  nftStatistics.updatedTimestamp = event.block.timestamp
  nftDayData.dailyTransactions = nftDayData.dailyTransactions.plus(ONE_BI)

  // Save
  from.save()
  to.save()
  nft.save()
  nftStatistics.save()
  nftDayData.save()
  
  let sender = getOrInitOwner(event.transaction.from.toHexString(), event)
  if (action == 'Mint') {
    sender.totalNftsMinted = sender.totalNftsMinted.plus(ONE_BI)
    sender.save()
  }
  
  // Create new transaction
  let gradeOfNft = action == 'Mint' ? getGradeOfNft(nft.id) : nft.grade
  initTransaction(
    event.transaction.hash.toHex(),
    action,
    gradeOfNft,
    nft,
    sender,
    from,
    to,
    event
  )
  
  log.info('[{}] {} transfer {} to {}', [
    action,
    from.id,
    nft.id,
    to.id
  ])
}

export function handleApprovalForAll(event: ApprovalForAll): void {
  if (event.params.approved == false) {
    return
  }

  let user = getOrInitOwner(event.params.owner.toHexString(), event)
  let contract = getOrInitContract(event.params.operator.toHexString(), event)
  let updatedUsers = contract.users
  updatedUsers.push(user.id)
  
  contract.users = updatedUsers
  let contractName = getContractName(event.params.operator.toHexString())
  contract.name = contractName
  contract.totalApprovalTransactions = contract.totalApprovalTransactions.plus(ONE_BI)
  contract.updatedTimestamp = event.block.timestamp
  contract.save()
}
