// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Transactor
/// @notice Single-shot escrow between an emitent (issuer) and a consumer.
///         Emitent funds the contract; consumer fulfills or partially credits the emitent.
contract Transactor {
    address public immutable emitent;

    address public immutable consumer;
    uint256 public remainingAmount;
    bool public closed;

    event Funded(address indexed from, uint256 amount);
    event PartiallyCredited(
        address indexed emitent,
        address indexed consumer,
        uint256 credited,
        uint256 remaining
    );
    event Fulfilled(address indexed consumer, uint256 amount);
    event Cancelled(address indexed emitent, uint256 refunded);

    error OnlyConsumer();
    error OnlyEmitent();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAmount();
    error InsufficientBalance();
    error AlreadyClosed();
    error TransferFailed();

    modifier onlyConsumer() {
        if (msg.sender != consumer) revert OnlyConsumer();
        _;
    }

    modifier onlyEmitent() {
        if (msg.sender != emitent) revert OnlyEmitent();
        _;
    }

    modifier whenOpen() {
        if (closed) revert AlreadyClosed();
        _;
    }

    /// @param _consumer Recipient of the final fulfillment transfer.
    /// @param amount Expected total settlement amount (tracked in `remainingAmount`).
    constructor(address _consumer, uint256 amount) payable {
        if (_consumer == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (msg.value < amount) revert InsufficientBalance();

        emitent = msg.sender;
        consumer = _consumer;
        remainingAmount = amount;

        if (msg.value > 0) {
            emit Funded(msg.sender, msg.value);
        }
    }

    /// @notice Accept top-up deposits from the emitent only while the contract is open.
    receive() external payable onlyEmitent whenOpen {
        if (msg.value == 0) revert ZeroAmount();
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Emitent adds ETH to the escrow while the transaction is open.
    function deposit() external payable onlyEmitent whenOpen {
        if (msg.value == 0) revert ZeroAmount();
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Consumer credits part of the obligation back to the emitent on-chain.
    /// @param amount Must be greater than zero and strictly less than `remainingAmount`.
    function partialCredit(uint256 amount) external onlyConsumer whenOpen {
        if (amount == 0 || amount >= remainingAmount) revert InvalidAmount();
        if (address(this).balance < amount) revert InsufficientBalance();

        remainingAmount -= amount;

        (bool success, ) = emitent.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit PartiallyCredited(emitent, consumer, amount, remainingAmount);
    }

    /// @notice Consumer completes the transaction; sends `remainingAmount` to the consumer.
    function fulfill() external onlyConsumer whenOpen {
        uint256 amount = remainingAmount;
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();

        closed = true;
        remainingAmount = 0;

        (bool success, ) = consumer.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Fulfilled(consumer, amount);

        _refundSurplusToEmitent();
    }

    /// @notice Emitent aborts and reclaims the full contract balance.
    function cancel() external onlyEmitent whenOpen {
        closed = true;
        remainingAmount = 0;

        uint256 balance = address(this).balance;
        if (balance == 0) {
            emit Cancelled(emitent, 0);
            return;
        }

        (bool success, ) = emitent.call{value: balance}("");
        if (!success) revert TransferFailed();

        emit Cancelled(emitent, balance);
    }

    function _refundSurplusToEmitent() private {
        uint256 surplus = address(this).balance;
        if (surplus == 0) {
            return;
        }

        (bool success, ) = emitent.call{value: surplus}("");
        if (!success) revert TransferFailed();
    }
}
