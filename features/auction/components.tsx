import type { ReactNode } from "react";
import { Clock3, Download, History, Loader2, RefreshCw, UsersRound, X } from "lucide-react";
import type { AuctionPlayer, HistoryRow, Purse, Team } from "./types";
import { displaySerial, money, pretty } from "./utils";

export function AuctionStat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <article className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span></div><p className="mt-3 text-2xl font-black">{value}</p></article>;
}

export function AuctionStatus({ value }: { value: AuctionPlayer["status"] }) {
  const style = value === "sold" ? "bg-emerald-500" : value === "live" ? "bg-red-500 animate-pulse" : value === "unsold" ? "bg-red-600" : "bg-sky-600";
  return <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[.65rem] font-black uppercase text-white ${style}`}>{value}</span>;
}

export function SquadPanel({ teams, players }: { teams: Team[]; players: AuctionPlayer[] }) {
  return <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="flex items-center gap-2 text-xl font-black"><UsersRound className="h-5 w-5 text-primary"/>Team Squads</h2><div className="mt-4 space-y-4">{teams.map((team) => <article key={team.id}><h3 className="rounded-lg bg-muted px-3 py-2 font-black">{team.name}</h3><div className="grid gap-2 py-2 sm:grid-cols-2">{players.filter((player) => player.winning_team_id === team.id).map((player) => <div key={player.id} className="grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 rounded-xl border border-border bg-background p-3 shadow-sm"><PlayerPhotoFromCard player={player}/><span className="min-w-0"><strong className="block truncate text-base">{player.player_name}</strong><small className="block capitalize text-muted-foreground">{pretty(player.playing_role)}</small><small className="block font-mono font-black text-primary">S.NO {String(displaySerial(player)).padStart(2, "0")}</small></span><span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-sm font-black text-emerald-600">{money(Number(player.winning_bid || 0))}</span></div>)}</div></article>)}</div></section>;
}

function PlayerPhotoFromCard({ player }: { player: AuctionPlayer }) {
  const image = player.player_card_url || player.photo_url;
  return <span role="img" aria-label={`${player.player_name} photo`} className="block h-[4.25rem] w-[4.25rem] shrink-0 rounded-xl border border-border bg-cover bg-no-repeat" style={{ backgroundImage: `url(${JSON.stringify(image)})`, backgroundPosition: "11% 45%", backgroundSize: "308% auto" }}/>;
}

export function HistoryPanel({ history, players, teams }: { history: HistoryRow[]; players: AuctionPlayer[]; teams: Team[] }) {
  const playerIds = new Set(players.map((player) => player.id));
  const latestPlayerActions = history.filter((row, index, rows) =>
    playerIds.has(row.auction_player_id)
    && rows.findIndex((candidate) => candidate.auction_player_id === row.auction_player_id) === index
  );
  return <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="flex items-center gap-2 text-xl font-black"><History className="h-5 w-5 text-primary"/>Auction History</h2><div className="mt-4 max-h-[32rem] divide-y divide-border overflow-y-auto">{latestPlayerActions.map((row) => { const player = players.find((item) => item.id === row.auction_player_id); const team = teams.find((item) => item.id === row.team_id); return player ? <div key={row.id} className="flex items-center gap-3 py-3 text-sm"><Clock3 className="h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-base">{player.player_name}</strong><span className="font-mono text-xs font-black text-primary">S.NO {String(displaySerial(player)).padStart(2, "0")}</span></div><p className="mt-1 capitalize text-muted-foreground">{row.action}{team ? ` · ${team.name}` : ""}</p></div>{row.bid_amount !== null && <strong>{money(Number(row.bid_amount))}</strong>}<time className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div> : null})}</div></section>;
}

export function DownloadButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button disabled={busy} onClick={onClick} className="control">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}{label}</button>;
}

export function AuctionEmpty({ text }: { text: string }) {
  return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-border text-muted-foreground">{text}</div>;
}

type AuctionPlayerDialogProps = {
  selected: AuctionPlayer;
  teams: Team[];
  selectedPurse: Purse | undefined;
  busy: string;
  editPlayerName: string;
  editPlayingRole: string;
  editSerial: string;
  saleTeamId: string;
  winningBid: string;
  availableBeforeBid: number;
  remaining: number;
  saleBlocked: boolean;
  teamName: (id: string | null) => string | undefined;
  onClose: () => void;
  onEditPlayerName: (value: string) => void;
  onEditPlayingRole: (value: string) => void;
  onEditSerial: (value: string) => void;
  onSaleTeamId: (value: string) => void;
  onWinningBid: (value: string) => void;
  onSaveText: () => void;
  onReopen: () => void;
  onUnsold: () => void;
  onConfirmSale: () => void;
};

export function AuctionPlayerDialog(props: AuctionPlayerDialogProps) {
  const { selected, teams, selectedPurse, busy, editPlayerName, editPlayingRole, editSerial, saleTeamId, winningBid, availableBeforeBid, remaining, saleBlocked } = props;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true"><section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-sm font-black text-primary">S.NO {String(displaySerial(selected)).padStart(2, "0")}</p><h2 className="text-2xl font-black">{selected.player_name}</h2><p className="text-sm capitalize text-muted-foreground">{pretty(selected.playing_role)}</p></div><button onClick={props.onClose} className="rounded-full bg-muted p-2"><X className="h-5 w-5"/></button></div>
    <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_6rem_auto]"><input aria-label="Player name" className="input" value={editPlayerName} onChange={(event) => props.onEditPlayerName(event.target.value)} placeholder="Player name"/><input aria-label="Playing role" className="input" value={editPlayingRole} onChange={(event) => props.onEditPlayingRole(event.target.value)} placeholder="Playing role"/><input aria-label="S.NO" className="input" type="number" min="1" value={editSerial} onChange={(event) => props.onEditSerial(event.target.value)} placeholder="S.NO"/><button disabled={busy === "save-player-text"} onClick={props.onSaveText} className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground">{busy === "save-player-text" ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save text"}</button></div>
    {selected.status === "unsold" ? <button onClick={props.onReopen} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground"><RefreshCw className="mr-2 inline h-4 w-4"/>Reopen Player</button> : selected.status === "sold" ? <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-900"><strong>Sold to {props.teamName(selected.winning_team_id)}</strong><p>{money(Number(selected.winning_bid || 0))}</p></div> : <><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-bold">Winning Team<select className="input" value={saleTeamId} onChange={(event) => props.onSaleTeamId(event.target.value)}><option value="">Select team</option>{teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="space-y-2 text-sm font-bold">Winning Bid Amount<input className="input" type="number" min="0" step=".01" value={winningBid} onChange={(event) => props.onWinningBid(event.target.value)}/></label></div>{saleTeamId && !selectedPurse && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">Team purse is not configured. Set its Initial Purse in Auction Controls and click Save Team Purses.</p>}{saleTeamId && selectedPurse && <div className={`mt-3 rounded-lg border p-3 text-sm font-bold ${remaining < 0 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}><p>Available before bid: {money(availableBeforeBid)}</p><p className="mt-1 text-base">Remaining after this bid: {money(remaining)}</p>{remaining < 0 && <p className="mt-1 text-xs">Winning bid exceeds the available purse.</p>}</div>}<div className="mt-6 grid grid-cols-2 gap-3"><button disabled={busy === "unsold"} onClick={props.onUnsold} className="rounded-xl border border-red-300 px-4 py-3 font-black text-red-600">Mark Unsold</button><button disabled={busy === "sell" || saleBlocked} onClick={props.onConfirmSale} className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "sell" && <Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>}Confirm Sale</button></div></>}
  </section></div>;
}
