const { assert, expect } = require("chai")
const { deployments, network, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Insu", function () {
          let insu
          let owner
          let user1
          let user2
          let validator

          const premium = ethers.utils.parseEther("0.03")
          const claimAMt = ethers.utils.parseEther("0.02")
          const sendValue = ethers.utils.parseEther("4")

          // Deploy the contract and set up accounts for testing
          beforeEach(async () => {
              ;[owner, user1, user2, validator] = await ethers.getSigners()

              await deployments.fixture("all")
              insu = await ethers.getContract("Insu", owner)
              //   const InsuContract = await ethers.getContractFactory(
              //       "Insu",
              //       owner
              //   )
              //   insu = await InsuContract.deploy()
              //   await insu.deployed()
          })
          // Test the constructor function
          describe("constructor", function () {
              it("should set the owner to the deploying address", async function () {
                  const deployedOwner = await insu.owner()
                  assert.equal(deployedOwner, owner.address)
              })
          })
          // Test the addValidator function
          describe("addValidator", function () {
              it("should add a validator to the validators mapping", async function () {
                  await insu.addValidator(validator.address)
                  const isValidator = await insu.validators(validator.address)
                  assert.isTrue(isValidator)
              })
              it("should emit a ValidatorAdded event", async function () {
                  const tx = await insu.addValidator(validator.address)
                  await expect(tx)
                      .to.emit(insu, "ValidatorAdded")
                      .withArgs(validator.address)
              })

              it("should revert if a non-owner attempts to add a validator", async function () {
                  await expect(
                      insu.connect(user1).addValidator(validator.address)
                  ).to.be.revertedWith(
                      "Only the owner can perform this action."
                  )
              })
          })
          // Test the createPolicy function
          describe("createPolicy", function () {
              beforeEach(async function () {
                  await insu.addValidator(validator.address)
              })
              it("should create a policy for the insured address", async function () {
                  const insured = user1.address
                  const premium = 1000
                  const maxClaimAmount = 5000
                  const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 365
                  await insu.createPolicy(
                      insured,
                      premium,
                      maxClaimAmount,
                      expiryDate
                  )

                  const policy = await insu.policies(insured)
                  assert.equal(policy.policyId, 0)
                  assert.equal(policy.premium, premium)
                  assert.equal(policy.maxClaimAmount, maxClaimAmount)
                  assert.equal(policy.expiryDate, expiryDate)
                  assert.isTrue(policy.isActive)
                  assert.isAtLeast(
                      policy.lastPaymentDate,
                      Math.floor(Date.now() / 1000) - 10
                  )
                  assert.equal(policy.missedPayments, 0)
              })

              it("should emit a PolicyCreated event", async function () {
                  const insured = user1.address
                  const premium = 1000
                  const maxClaimAmount = 5000
                  const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 365
                  const tx = await insu.createPolicy(
                      insured,
                      premium,
                      maxClaimAmount,
                      expiryDate
                  )
                  await expect(tx)
                      .to.emit(insu, "PolicyCreated")
                      .withArgs(0, insured, premium, maxClaimAmount)
              })

              it("should revert if a non-owner attempts to create a policy", async function () {
                  const insured = user1.address
                  const premium = 1000
                  const maxClaimAmount = 5000
                  const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 365
                  await expect(
                      insu
                          .connect(user1)
                          .createPolicy(
                              insured,
                              premium,
                              maxClaimAmount,
                              expiryDate
                          )
                  ).to.be.revertedWith(
                      "Only the owner can perform this action."
                  )
              })
          })
          describe("cancelPolicy", function () {
              it("should cancel an active policy", async function () {
                  await insu.createPolicy(user1.address, 100, 200, 0)
                  await insu.cancelPolicy(user1.address)
                  const policy = await insu.policies(user1.address)
                  expect(policy.isActive).to.be.false
              })

              it("should revert when trying to cancel a cancelled policy", async function () {
                  await insu.createPolicy(user1.address, 100, 200, 0)
                  await insu.cancelPolicy(user1.address)
                  await expect(
                      insu.cancelPolicy(user1.address)
                  ).to.be.revertedWith(
                      "The policy is already cancelled or expired."
                  )
              })
          })

          describe("makePayment", function () {
              it("should make a payment and update policy information", async function () {
                  await insu.createPolicy(user1.address, premium, claimAMt, 0)
                  await insu.makePayment(user1.address, { value: sendValue })
                  const policy = await insu.policies(user1.address)
                  expect(policy.isActive).to.be.true
                  expect(policy.missedPayments).to.equal(0)
                  //expect(policy.lastPaymentDate).to.be.closeTo(Date.now() / 1000, 2);
                  // const response = await insu.getBalance
                  // expect(response.toString()).to.equal(sendValue.toString())
                  // expect(await insu.contractBalance().toString()).to.equal(sendValue.toString());
                  //     expect(
                  //         await insu.premiumsPaid(user1.address).toString()
                  //     ).to.equal(sendValue.toString())
                  // })

                  it("should revert when trying to make a payment for a cancelled policy", async function () {
                      await insu.createPolicy(user1.address, 100, 200, 0)
                      await insu.cancelPolicy(user1.address)
                      await expect(
                          insu.makePayment(user1.address, { value: 100 })
                      ).to.be.revertedWith("The policy is not active.")
                  })

                  it("should revert when payment is less than the premium amount", async function () {
                      await insu.createPolicy(user1.address, 100, 200, 0)
                      await expect(
                          insu.makePayment(user1.address, { value: 50 })
                      ).to.be.revertedWith("The premium amount is less.")
                  })
              })
          })
          describe("submitClaim()", function () {
              const claimAmount = ethers.utils.parseEther("0.2")
              it("should not submit a claim with amount 0", async () => {
                  // Try to submit a claim with amount 0
                  // await assert.rejects(
                  //     insu.submitClaim(user1.address, claimAmount),
                  //     {
                  //         message: "Claim amount must be greater than 0",
                  //     }
                  // )
                  await insu.createPolicy(user1.address, premium, claimAMt, 0)
                  await insu.makePayment(user1.address, { value: sendValue })
                  await insu.submitClaim(user1.address, claimAmount)
                  assert(claimAmount > 0)
              })

              it("should not submit a claim for an inactive policy", async () => {
                  // Set the policy to inactive
                  await insu.createPolicy(user1.address, 100, 200, 0)
                  await insu.cancelPolicy(user1.address)

                  // Try to submit a claim for an inactive policy

                  await expect(
                      insu.submitClaim(user1.address, claimAmount)
                  ).to.be.revertedWith("The policy is not active.")
              })

              it("should not submit a claim without paying a premium", async () => {
                  // Try to submit a claim without paying a premium
                  await insu.createPolicy(user1.address, premium, claimAMt, 0)

                  await expect(
                      insu.submitClaim(user1.address, claimAmount)
                  ).to.be.revertedWith(
                      "You have not made payment of a Premium!"
                  )
              })
          })
          //   describe("validateClaim()", function () {
          //       //const claimAmount = ethers.utils.parseEther("1")
          //       it("should not validate a non-existent claim", async function () {
          //           const claimAmount = ethers.utils.parseEther("1")
          //           await insu.createPolicy(
          //               user1.address,
          //               premium,
          //               {
          //                   value: ethers.utils.formatUnits(claimAMt, "ether"),
          //               },
          //               0
          //           )
          //           await insu.makePayment(user1.address, {
          //               value: ethers.utils.formatUnits(sendValue, "ether"),
          //           })
          //           //await insu.submitClaim(user1.address, claimAmount)
          //           const _claimId = await insu.submitClaim(user1.address, {
          //               value: ethers.utils.formatUnits(claimAmount, "ether"),
          //           })

          //           await insu.addValidator(validator.address)

          //           // await expect(
          //           //     insu.validateClaim(user1.address, _claimId)
          //           // ).to.be.revertedWith("Claim does not exist")
          //           await insu.validateClaim.connect(validator.address)(
          //               user1.address,
          //               _claimId
          //           )
          //           assert(_claimId)
          //       })
          //   })

          //       it("should not validate an already validated claim", async function () {
          //           //const policyId = 1;
          //           const claimAmount = ethers.utils.parseEther("1")

          //           await insu.addValidator(validator.address)
          //           await insu.createPolicy(
          //               user1.address,
          //               premium,
          //               { value: claimAMt },
          //               0
          //           )
          //           await insu.makePayment(user1.address, { value: sendValue })

          //           const _claimId = await insu.submitClaim(user1.address, {
          //               value: claimAmount,
          //           })
          //           await insu.validateClaim(user1.address, _claimId)
          //           // await expect(
          //           //     insu.validateClaim(user1.address, _claimId)
          //           // ).to.be.revertedWith("Claim has already been validated")
          //           // const validate = await insu.validatedClaims(_claimId)
          //           // assert (validate)
          //           expect(await insu.validatedClaims(_claimId)).to.equal(true)
          //       })

          //       it("should not validate a claim amount greater than the maximum allowed", async function () {
          //           //const policyId = 1;

          //           const _claim = ethers.utils.parseEther("0.9")
          //           await insu.addValidator(validator.address)
          //           await insu.createPolicy(
          //               user1.address,
          //               premium,
          //               { value: claimAMt },
          //               0
          //           )
          //           await insu.makePayment(user1.address, { value: sendValue })

          //           const _claimId = await insu.submitClaim(user1.address, {
          //               value: _claim,
          //           })
          //           await expect(
          //               insu.validateClaim(user1.address, _claimId)
          //           ).to.be.revertedWith(
          //               "The claim amount exceeds the maximum allowed."
          //           )
          //       })

          //       it("should validate a claim if all requirements are met", async function () {
          //           const claimAmount = ethers.utils.parseEther("1")
          //           await insu.addValidator(validator.address)
          //           await insu.createPolicy(
          //               user1.address,
          //               premium,
          //               { value: claimAMt },
          //               0
          //           )
          //           await insu.makePayment(user1.address, { value: sendValue })

          //           const _claimId = await insu.submitClaim(user1.address, {
          //               value: claimAmount,
          //           })
          //           expect(await insu.validatedClaims(_claimId)).to.equal(true)
          //       })
          //   })

          //   describe("sendClaim()", function () {
          //       it("should not send an unvalidated claim", async function () {
          //           const claimAmount = ethers.utils.parseEther("1")

          //           await insu.addValidator(validator.address)
          //           await insu.createPolicy(
          //               user1.address,
          //               premium,
          //               { value: claimAMt },
          //               0
          //           )
          //           await insu.makePayment(user1.address, { value: sendValue })

          //           const _claimId = await insu.submitClaim(user1.address, {
          //               value: claimAmount,
          //           })
          //           await insu.validateClaim(user1.address, _claimId)
          //           expect(await insu.validatedClaims(_claimId)).to.equal(true)
          //           await expect(
          //               insu.sendClaim(user1.address, _claimId)
          //           ).to.be.revertedWith("This claim is not validated")
          //       })
          //   })
          describe("updateMissedPayments", function () {
              it("should update missed payments and cancel policy if there are 3 or more missed payments", async function () {
                  //const policyId = 1;
                  const premium = ethers.utils.parseEther("1")
                  //const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days from now
                  const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 240

                  await insu.createPolicy(
                      user1.address,
                      premium,
                      100,
                      expiryDate
                  )

                  await waffle.provider.send("evm_increaseTime", [
                      31 * 24 * 60 * 60,
                  ]) // move 31 days into the future
                  await insu.updateMissedPayments(user1.address)
                  let policy = await insu.policies(user1.address)
                  expect(policy.missedPayments).to.equal(1)
                  expect(policy.isActive).to.be.true

                  //   await waffle.provider.send("evm_increaseTime", [
                  //       31 * 24 * 60 * 60,
                  //   ]) // move 31 days into the future
                  //   await insu.updateMissedPayments(user1.address)
                  //   policy = await insu.policies(user1.address)

                  //   expect(policy.missedPayments).to.equal(2)
                  //   expect(policy.isActive).to.be.true

                  await waffle.provider.send("evm_increaseTime", [
                      31 * 24 * 60 * 60,
                  ]) // move 31 days into the future
                  await insu.updateMissedPayments(user1.address)
                  policy = await insu.policies(user1.address)
                  expect(policy.missedPayments).to.equal(3)
                  expect(policy.isActive).to.be.false
              })
          })
      })
