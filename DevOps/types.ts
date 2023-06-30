type Column = "pubkey" | "eventID";
type Table = string;
type Distinct = "DISTINCT" | "";
export type SQL = `SELECT ${Distinct}(${Column}) From ${Table}`;
