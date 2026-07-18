"use client";

import React, { useReducer, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

// Toss State
type TossState = {
  winner: string;
  decision: 'Bat' | 'Bowl' | null;
  notes: string;
};

// Complex State Management for Live Scoring
type ScoreState = {
  runs: number;
  wickets: number;
  overs: number;
  ballsThisOver: number;
  currentStriker: string | null;
  nonStriker: string | null;
  currentBowler: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ballHistory: any[];
  isLocked: boolean;
};

type ScoreAction = 
  | { type: 'SCORE_RUNS', runs: number }
  | { type: 'SCORE_EXTRAS', extraType: string, runs: number, isValidBall: boolean }
  | { type: 'WICKET', wicketType: string }
  | { type: 'UNDO' }
  | { type: 'LOCK_MATCH' }
  | { type: 'INIT', payload: Partial<ScoreState> };

function scoreReducer(state: ScoreState, action: ScoreAction): ScoreState {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload };
      
    case 'SCORE_RUNS': {
      if (state.isLocked) return state;
      
      const newBalls = state.ballsThisOver + 1;
      let newOvers = state.overs;
      let nextBalls = newBalls;
      
      if (newBalls === 6) {
        newOvers = Math.floor(state.overs) + 1.0;
        nextBalls = 0;
      } else {
        newOvers = Math.floor(state.overs) + (newBalls / 10);
      }

      const historyItem = { ...state };
      
      // Strike rotation simplified: odd runs swap
      const shouldSwap = action.runs % 2 !== 0;
      
      return {
        ...state,
        runs: state.runs + action.runs,
        overs: newOvers,
        ballsThisOver: nextBalls,
        currentStriker: shouldSwap ? state.nonStriker : state.currentStriker,
        nonStriker: shouldSwap ? state.currentStriker : state.nonStriker,
        ballHistory: [...state.ballHistory, historyItem],
      };
    }

    case 'SCORE_EXTRAS': {
      if (state.isLocked) return state;
      const historyItem = { ...state };
      
      let newOvers = state.overs;
      let nextBalls = state.ballsThisOver;

      if (action.isValidBall) {
        nextBalls += 1;
        if (nextBalls === 6) {
          newOvers = Math.floor(state.overs) + 1.0;
          nextBalls = 0;
        } else {
          newOvers = Math.floor(state.overs) + (nextBalls / 10);
        }
      }

      return {
        ...state,
        runs: state.runs + action.runs,
        overs: newOvers,
        ballsThisOver: nextBalls,
        ballHistory: [...state.ballHistory, historyItem],
      };
    }

    case 'WICKET': {
      if (state.isLocked) return state;
      const historyItem = { ...state };
      
      const newBalls = state.ballsThisOver + 1;
      let newOvers = state.overs;
      let nextBalls = newBalls;
      
      if (newBalls === 6) {
        newOvers = Math.floor(state.overs) + 1.0;
        nextBalls = 0;
      } else {
        newOvers = Math.floor(state.overs) + (newBalls / 10);
      }

      return {
        ...state,
        wickets: state.wickets + 1,
        overs: newOvers,
        ballsThisOver: nextBalls,
        ballHistory: [...state.ballHistory, historyItem],
      };
    }

    case 'UNDO': {
      if (state.isLocked || state.ballHistory.length === 0) return state;
      const previousState = state.ballHistory[state.ballHistory.length - 1];
      return { ...previousState, ballHistory: state.ballHistory.slice(0, -1) };
    }

    case 'LOCK_MATCH':
      return { ...state, isLocked: true };

    default:
      return state;
  }
}

export default function MatchScoringEngine() {
  const { id } = useParams();
  
  const [state, dispatch] = useReducer(scoreReducer, {
    runs: 0,
    wickets: 0,
    overs: 0.0,
    ballsThisOver: 0,
    currentStriker: 'Player A',
    nonStriker: 'Player B',
    currentBowler: 'Player C',
    ballHistory: [],
    isLocked: false
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showTossModal, setShowTossModal] = useState(false);
  const [tossState, setTossState] = useState<TossState>({ winner: 'Team 1', decision: null, notes: '' });

  useEffect(() => {
    // Initial Fetch logic
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, [id]);

  // Synchronous Auto Save wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoSaveBall = async (ballData: any, localAction: () => void) => {
    if (state.isLocked || syncing) return;
    setSyncing(true);
    try {
      // In a full implementation, insert into ball_by_ball here.
      // e.g., await supabase.from('ball_by_ball').insert({...ballData});
      
      // Update local state and broadcast
      localAction();
    } catch (error) {
      console.error("Scoring error:", error);
      alert("Network error: Failed to save ball. Progress not lost, try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleScoreRuns = (runs: number) => {
    autoSaveBall({ runs, isExtra: false, isWicket: false }, () => {
      dispatch({ type: 'SCORE_RUNS', runs });
    });
  };

  const handleExtras = (type: string, runs: number, isValidBall: boolean) => {
    autoSaveBall({ runs, isExtra: true, extraType: type, isWicket: false }, () => {
      dispatch({ type: 'SCORE_EXTRAS', extraType: type, runs, isValidBall });
    });
  };

  const handleWicket = (wicketType: string) => {
    autoSaveBall({ runs: 0, isExtra: false, isWicket: true, wicketType }, () => {
      dispatch({ type: 'WICKET', wicketType });
    });
  };

  const handleUndo = () => {
    dispatch({ type: 'UNDO' });
  };

  const lockMatch = async () => {
    if (confirm("Are you sure you want to finish this match? No further scoring will be allowed.")) {
      dispatch({ type: 'LOCK_MATCH' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('matches') as any).update({ status: 'completed' }).eq('id', id);
      alert("Match Locked and Saved successfully.");
    }
  };

  const handleSaveToss = async () => {
    if (!tossState.decision) return alert("Select a decision");
    setSyncing(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('matches') as any).update({
      toss_winner_id: tossState.winner, // In a real app this is a UUID
      toss_decision: tossState.decision,
      toss_notes: tossState.notes,
      toss_time: new Date().toISOString()
    }).eq('id', id);
    setSyncing(false);
    setShowTossModal(false);
    alert("Toss saved successfully");
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="flex items-center gap-4">
          <Link href="/admin/matches" className="p-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-xl">Match #{id}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>1st Innings • Live Scoring</span>
              {syncing ? <span className="text-yellow-500 animate-pulse text-xs">Syncing...</span> : <span className="text-green-500 text-xs">Auto-saved</span>}
              {state.isLocked && <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold uppercase">Locked</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTossModal(true)}
            disabled={state.isLocked}
            className="px-4 py-2 bg-muted text-foreground rounded-md disabled:opacity-50 hover:bg-muted/80 text-sm font-medium"
          >
            Toss
          </button>
          <button 
            onClick={handleUndo} 
            disabled={state.ballHistory.length === 0 || state.isLocked || syncing} 
            className="p-2 bg-secondary text-secondary-foreground rounded-md disabled:opacity-50 hover:bg-secondary/80"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={lockMatch}
            disabled={state.isLocked || syncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90"
          >
            <CheckCircle2 className="w-4 h-4" /> Finish Match
          </button>
        </div>
      </div>

      {state.isLocked && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-center font-bold">
          Match Locked - Editing Disabled
        </div>
      )}

      {showTossModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-xl shadow-lg max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold">Match Toss</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Toss Winner</label>
              <select 
                className="w-full p-2 rounded-md border border-input bg-background"
                value={tossState.winner}
                onChange={e => setTossState({...tossState, winner: e.target.value})}
              >
                <option value="Team 1">Team 1</option>
                <option value="Team 2">Team 2</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Decision</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTossState({...tossState, decision: 'Bat'})}
                  className={`flex-1 p-2 rounded-md border ${tossState.decision === 'Bat' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}
                >Bat</button>
                <button 
                  onClick={() => setTossState({...tossState, decision: 'Bowl'})}
                  className={`flex-1 p-2 rounded-md border ${tossState.decision === 'Bowl' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}
                >Bowl</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <textarea 
                className="w-full p-2 rounded-md border border-input bg-background"
                placeholder="E.g., Pitch looks dry"
                value={tossState.notes}
                onChange={e => setTossState({...tossState, notes: e.target.value})}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <button 
                onClick={() => setShowTossModal(false)}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted"
              >Cancel</button>
              <button 
                onClick={handleSaveToss}
                disabled={syncing}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >Save Toss</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Score Board */}
      <div className="bg-primary text-primary-foreground p-8 rounded-xl flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-white/20">
          <div className="h-full bg-green-400 w-1/3"></div>
        </div>
        <h2 className="text-6xl font-black tabular-nums tracking-tighter">
          {state.runs}<span className="text-3xl text-primary-foreground/70 font-medium">/{state.wickets}</span>
        </h2>
        <p className="text-xl mt-2 font-medium opacity-90">Overs: {state.overs.toFixed(1)} / 20.0</p>
        <p className="text-sm mt-1 opacity-70">CRR: {state.overs > 0 ? (state.runs / state.overs).toFixed(2) : '0.00'}</p>
        
        {/* Current Players */}
        <div className="mt-6 w-full flex justify-between px-8 text-sm opacity-90 border-t border-white/20 pt-4">
          <div>
            <span className="font-bold text-yellow-400">{state.currentStriker}*</span> | <span>{state.nonStriker}</span>
          </div>
          <div>
            <span>Bowler: </span><span className="font-bold">{state.currentBowler}</span>
          </div>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Runs Pad */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <h3 className="font-semibold mb-3">Runs</h3>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 6].map(run => (
              <button 
                key={run} 
                onClick={() => handleScoreRuns(run)}
                disabled={state.isLocked || syncing}
                className={`py-6 rounded-lg font-bold text-xl transition-colors disabled:opacity-50 ${
                  run === 4 || run === 6 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                }`}
              >
                {run}
              </button>
            ))}
          </div>
        </div>

        {/* Extras & Wickets */}
        <div className="space-y-4">
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold mb-3">Extras</h3>
            <div className="grid grid-cols-4 gap-2">
              <button disabled={state.isLocked || syncing} onClick={() => handleExtras('wide', 1, false)} className="py-3 bg-yellow-500/10 text-yellow-600 font-medium rounded-lg hover:bg-yellow-500/20 disabled:opacity-50">Wd</button>
              <button disabled={state.isLocked || syncing} onClick={() => handleExtras('no_ball', 1, false)} className="py-3 bg-yellow-500/10 text-yellow-600 font-medium rounded-lg hover:bg-yellow-500/20 disabled:opacity-50">NB</button>
              <button disabled={state.isLocked || syncing} onClick={() => handleExtras('bye', 1, true)} className="py-3 bg-gray-500/10 text-gray-600 font-medium rounded-lg hover:bg-gray-500/20 disabled:opacity-50">B</button>
              <button disabled={state.isLocked || syncing} onClick={() => handleExtras('leg_bye', 1, true)} className="py-3 bg-gray-500/10 text-gray-600 font-medium rounded-lg hover:bg-gray-500/20 disabled:opacity-50">LB</button>
            </div>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <h3 className="font-semibold mb-3 text-red-500">Wicket</h3>
            <div className="grid grid-cols-3 gap-2">
              {['Bowled', 'Caught', 'Run Out', 'LBW', 'Stumped'].map(w => (
                <button 
                  key={w}
                  onClick={() => handleWicket(w)}
                  disabled={state.isLocked || syncing}
                  className="py-3 bg-red-500/10 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500/20 disabled:opacity-50"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
