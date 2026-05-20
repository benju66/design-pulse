/**
 * DataTable Cell System — Generic, composable cell components.
 *
 * These cells replace domain-typed implementations across
 * Value Matrix, Coordination Board, and Permit Board.
 */

export { CellWrapper } from './CellWrapper';
export type { CellWrapperProps } from './CellWrapper';

export { TextCell } from './TextCell';
export type { TextCellProps } from './TextCell';

export { SelectCell } from './SelectCell';
export type { SelectCellProps, SelectOption } from './SelectCell';

export { CheckboxCell, CheckboxHeader } from './CheckboxCell';
export type { CheckboxCellProps, CheckboxHeaderProps } from './CheckboxCell';

export { DateCell } from './DateCell';
export type { DateCellProps } from './DateCell';

export { OpenPanelCell } from './OpenPanelCell';
export type { OpenPanelCellProps } from './OpenPanelCell';

export { commonCellComparator, useIsCellActive } from './commonComparator';
