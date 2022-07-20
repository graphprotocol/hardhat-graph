import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import { MessageTraceStep, isCreateTrace, isCallTrace, CreateMessageTrace, CallMessageTrace, isEvmStep, isPrecompileTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

export const traceHandler = async (hre: HardhatRuntimeEnvironment, trace: MessageTraceStep) => {
  let stepper = async (step: MessageTraceStep) => {
      if (isEvmStep(step) || isPrecompileTrace(step))
          return;
      if (isCreateTrace(step) && step.deployedContract) {
          const address = `0x${step.deployedContract.toString('hex')}`;
          const bytecode = await hre.ethers.provider.getCode(address);
          // this.trace.push({
          //     op: 'CREATE2',
          //     contractHashedBytecode: hre.ethers.utils.keccak256(bytecode),
          //     address: address,
          //     depth: step.depth
          // });
      }
      if (isCallTrace(step)) {
          const address = `0x${step.address.toString('hex')}`;
          const bytecode = await hre.ethers.provider.getCode(address);
          // this.trace.push({
          //     op: 'CALL',
          //     contractHashedBytecode: hre.ethers.utils.keccak256(bytecode),
          //     address: address,
          //     input: step.calldata.toString('hex'),
          //     depth: step.depth,
          //     returnData: step.returnData.toString('hex')
          // });
      }
      for (var i = 0; i < step.steps.length; i++) {
          await stepper(step.steps[i]);
      }
  };

  if (!isEvmStep(trace) && !isPrecompileTrace(trace)) {
    for (const step of trace.steps) {
      console.log(step);
      stepper(step);
    }
  }
}