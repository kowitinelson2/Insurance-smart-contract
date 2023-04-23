// SPDX-License-Identifier:MIT
pragma solidity ^0.8.7;

contract Insu {
    address payable public owner; // The insurance company is the owner of the contract
    uint256 public contractBalance; // Current balance of the contract
    uint256 public totalPremiums; // Total premiums collected
    uint256 public totalClaims; // Total claims paid out
    uint256 public policyCounter; // Counter for policy IDs
    uint public nextClaimId;
    mapping(address => Policy) public policies; // List of policies
    mapping(uint => address) public claimToPolicyholder;
    mapping(uint => uint) public claimAmounts;
    mapping(uint => bool) public validatedClaims;
    mapping(address => bool) public validators;
    mapping(address => uint256) premiumsPaid;

    struct Policy {
        uint256 policyId;
        uint256 premium;
        uint256 maxClaimAmount;
        uint256 totalClaimAmount;
        uint256 expiryDate;
        bool isActive;
        uint256 lastPaymentDate;
        uint256 missedPayments;
    }
    event ClaimValidated(uint indexed claimId);
    event ClaimSubmitted(
        uint indexed claimId,
        address indexed policyHolder,
        uint amount
    );
    event ValidatorAdded(address indexed validator);
    event PaymentMade(address indexed policyHolder, uint amount);
    event ClaimSent(uint indexed claimId);
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed policyHolder,
        uint256 premium,
        uint256 maxClaimAmount
    );
    event PolicyCancelled(
        uint256 indexed policyId,
        address indexed policyHolder
    );
    event PolicyExpired(uint256 indexed policyId, address indexed policyHolder);

    constructor() {
        owner = payable(msg.sender); // Set the owner to the address that deployed the contract
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }
    modifier onlyValidator() {
        require(
            validators[msg.sender] == true,
            "Only validator can call this function"
        );
        _;
    }

    function addValidator(address _validator) public onlyOwner {
        validators[_validator] = true;
        emit ValidatorAdded(_validator);
    }

    function createPolicy(
        address _insured,
        uint256 _premium,
        uint256 _maxClaimAmount,
        uint256 _expiryDate
    ) public onlyOwner {
        Policy storage policy = policies[_insured];
        policy.policyId = policyCounter++;
        policy.premium = _premium;
        policy.maxClaimAmount = _maxClaimAmount;
        policy.expiryDate = _expiryDate;
        policy.isActive = true;
        policy.lastPaymentDate = block.timestamp;
        emit PolicyCreated(
            policy.policyId,
            _insured,
            _premium,
            _maxClaimAmount
        );
    }

    function cancelPolicy(address _insured) public onlyOwner {
        Policy storage policy = policies[_insured];
        require(policy.isActive, "The policy is already cancelled or expired.");
        policy.isActive = false;
        emit PolicyCancelled(policy.policyId, _insured);
    }

    function makePayment(address _insured) public payable {
        Policy storage policy = policies[_insured];
        require(policy.isActive, "The policy is not active.");
        require(msg.value >= policy.premium, "The premium amount is less.");
        policy.lastPaymentDate = block.timestamp;
        policy.missedPayments = 0;
        totalPremiums += msg.value;
        contractBalance += msg.value;
        premiumsPaid[_insured] = msg.value;
        emit PaymentMade(msg.sender, msg.value);
    }

    function submitClaim(
        address _insured,
        uint256 _claimAmount
    ) public returns (uint256) {
        Policy storage policy = policies[_insured];
        require(_claimAmount > 0, "Claim amount must be greater than 0");
        require(policy.isActive, "The policy is not active.");
        require(
            premiumsPaid[_insured] > 0,
            "You have not made payment of a Premium!"
        );
        uint claimId = nextClaimId;
        nextClaimId += 1;
        claimToPolicyholder[claimId] = _insured;
        claimAmounts[claimId] = _claimAmount;
        emit ClaimSubmitted(claimId, _insured, _claimAmount);
        return claimId;
    }

    function validateClaim(
        address _insured,
        uint _claimId
    ) public onlyValidator {
        Policy storage policy = policies[_insured];
        require(claimAmounts[_claimId] > 0, "Claim does not exist");
        require(!validatedClaims[_claimId], "Claim has already been validated");
        require(
            claimAmounts[_claimId] <= policy.maxClaimAmount,
            "The claim amount exceeds the maximum allowed."
        );
        //require(policy.totalClaimAmount + claimAmounts[_claimId] <= policy.maxClaimAmount, "The total claim amount exceeds the maximum allowed.");
        //require(policy.lastPaymentDate >= policy.expiryDate, "The policy has expired.");
        policy.totalClaimAmount += claimAmounts[_claimId];
        require(
            claimAmounts[_claimId] <= contractBalance,
            "The claim amount exceeds the available contract balance."
        );
        validatedClaims[_claimId] = true;
        totalClaims += claimAmounts[_claimId];
        emit ClaimValidated(_claimId);
    }

    function sendClaim(address _insured, uint _claimId) public onlyOwner {
        require(
            validatedClaims[_claimId] = true,
            "This claim has not been validated"
        );
        contractBalance -= claimAmounts[_claimId];
        // Transfer the claim amount to the insured
        payable(_insured).transfer(claimAmounts[_claimId]);
        emit ClaimSent(_claimId);
    }

    function updateMissedPayments(address _insured) public onlyOwner {
        Policy storage policy = policies[_insured];
        uint256 missedPayments = (block.timestamp - policy.lastPaymentDate) /
            30 days; // Number of missed payments
        if (missedPayments > 0) {
            policy.missedPayments += missedPayments;
            policy.isActive = policy.missedPayments < 3; // Policy is canceled if there are 3 or more missed payments
        }
    }

    function getBalance() public view onlyOwner returns (uint) {
        return address(this).balance;
    }

    function withdrawFunds() public onlyOwner {
        // Transfer the contract balance to the owner
        payable(owner).transfer(address(this).balance);
    }

    function getTotalPremiums() public view onlyOwner returns (uint256) {
        return totalPremiums;
    }

    function getTotalClaims() public view onlyOwner returns (uint256) {
        return totalClaims;
    }

    function getPolicy(address _insured) public view returns (Policy memory) {
        Policy memory policy = policies[_insured];
        return policy;
    }

    // fallback() external payable {
    //     contractBalance += msg.value;
    // }
    receive() external payable {
        makePayment(msg.sender);
    }
}
