// Node type registry for React Flow
import TriggerNode from './TriggerNode';
import ActionNode from './ActionNode';
import LogicNode from './LogicNode';

export const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    logic: LogicNode,
};

export { TriggerNode, ActionNode, LogicNode };
