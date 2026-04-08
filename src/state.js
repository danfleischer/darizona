var state = {
  // auth
  userId: null,
  userEmail: null,
  displayName: null,

  // pool
  shareToken: "",
  poolId: null,
  poolData: null,      // { id, buyin, prop_buyin, masters_locked_at, props_locked_at, created_by }
  players: [],         // [{ user_id, display_name, is_commissioner }]

  // current user's in-progress picks (keyed by tier 1-6)
  myPicks: {},         // { 1: "Golfer Name" | null, ..., 6: ... }
  myPicksSubmitted: false,

  // current user's in-progress prop picks (keyed by prop_id)
  myPropPicks: {},     // { [propId]: value | null }
  myPropPicksSubmitted: false,

  // leaderboard
  espnScores: null,
  lbTimer: null,

  // picks from supabase for all players (populated after RLS allows it)
  allPicks: {},        // { [userId]: { 1: name, ..., 6: name } }
  allPropPicks: {},    // { [userId]: { [propId]: value } }
  propResults: {},     // { [propId]: value }

  // ui state
  tierCollapsed: {},
  pendingResults: {},
};

export default state;
