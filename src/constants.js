export var MASTERS_LOCK = new Date("2026-04-09T12:00:00Z"); // 8am ET Thursday
export var PROPS_LOCK   = new Date("2026-04-12T14:00:00Z"); // 10am ET Saturday
export var CUT_PENALTY  = 80;
export var NUM_PROPS    = 10;

export var PROPS = [
  { id:"low_gross",     label:"Lowest gross score",              type:"player",     q:"Who shoots the lowest gross score in the group on Saturday?" },
  { id:"high_gross",    label:"Highest gross score",             type:"player",     q:"Who shoots the highest gross score? (not counting anyone who leaves early)" },
  { id:"long_drive",    label:"Longest drive",                   type:"player",     q:"Who hits the longest drive? Commissioner picks the hole on the day." },
  { id:"closest_pin",   label:"Closest to the pin",              type:"player",     q:"Who is closest to the pin on the designated par 3? (announced on course)" },
  { id:"first_lost",    label:"First lost ball",                 type:"player",     q:"Who loses the very first ball of the round?" },
  { id:"high_hole",     label:"Highest score on one hole",       type:"number",     q:"What is the highest score anyone makes on a single hole? Closest guess wins (tie: lower guess wins)." },
  { id:"darren_score",  label:"Darren's exact score",            type:"number",     q:"What does Darren shoot for 18 holes? Closest guess wins (tie: lower guess wins)." },
  { id:"darren_high",   label:"Darren's worst hole",             type:"number",     q:"What is the highest score Darren makes on any single hole?" },
  { id:"darren_low",    label:"Darren's best hole",              type:"number",     q:"What is the lowest score Darren makes on any single hole?" },
  { id:"darren_3putt",  label:"Darren 3-putts hole 1",          type:"yes_no",     q:"Does Darren take 3 or more putts on the very first hole?" }
];

export var TIERS = [
  {id:1,label:"Tier 1 \u2014 Favorites",lc:"tl1",chip:"ch1",golfers:[
    {n:"Scottie Scheffler",o:"+410"},{n:"Jon Rahm",o:"+850"},
    {n:"Rory McIlroy",o:"+1025"},{n:"Bryson DeChambeau",o:"+1100"}]},
  {id:2,label:"Tier 2 \u2014 Contenders",lc:"tl2",chip:"ch2",golfers:[
    {n:"Ludvig Aberg",o:"+1750"},{n:"Xander Schauffele",o:"+1850"},
    {n:"Cameron Young",o:"+2400"},{n:"Tommy Fleetwood",o:"+2500"},
    {n:"Matt Fitzpatrick",o:"+2600"},{n:"Collin Morikawa",o:"+3100"}]},
  {id:3,label:"Tier 3 \u2014 Mid-range",lc:"tl3",chip:"ch3",golfers:[
    {n:"Justin Rose",o:"+3600"},{n:"Jordan Spieth",o:"+3800"},
    {n:"Brooks Koepka",o:"+3800"},{n:"Hideki Matsuyama",o:"+3900"},
    {n:"Robert MacIntyre",o:"+4000"},{n:"Russell Henley",o:"+4200"},
    {n:"Chris Gotterup",o:"+4300"},{n:"Patrick Reed",o:"+4500"},
    {n:"Viktor Hovland",o:"+4600"},{n:"Si Woo Kim",o:"+4700"},
    {n:"Min Woo Lee",o:"+5400"},{n:"Justin Thomas",o:"+5500"},
    {n:"Patrick Cantlay",o:"+5700"},{n:"Adam Scott",o:"+6200"},
    {n:"Akshay Bhatia",o:"+6600"},{n:"Sepp Straka",o:"+6700"},
    {n:"Jason Day",o:"+6900"},{n:"Jake Knapp",o:"+6900"},
    {n:"Tyrrell Hatton",o:"+6900"},{n:"Shane Lowry",o:"+7000"}]},
  {id:4,label:"Tier 4 \u2014 Longshots",lc:"tl4",chip:"ch4",golfers:[
    {n:"Sam Burns",o:"+7200"},{n:"Corey Conners",o:"+8200"},
    {n:"Nicolai Hojgaard",o:"+8400"},{n:"Kurt Kitayama",o:"+8800"},
    {n:"J.J. Spaun",o:"+8800"},{n:"Jacob Bridgeman",o:"+9400"},
    {n:"Maverick McNealy",o:"+9800"},{n:"Cameron Smith",o:"+10000"},
    {n:"Harris English",o:"+10500"},{n:"Gary Woodland",o:"+11000"},
    {n:"Ben Griffin",o:"+11000"},{n:"Daniel Berger",o:"+11000"},
    {n:"Max Homa",o:"+11500"},{n:"Sung-Jae Im",o:"+12000"},
    {n:"Rasmus Hojgaard",o:"+13000"},{n:"Keegan Bradley",o:"+14000"},
    {n:"Harry Hall",o:"+16000"},{n:"Marco Penge",o:"+16000"},
    {n:"Alex Noren",o:"+16500"},{n:"Ryan Gerard",o:"+17000"},
    {n:"Nick Taylor",o:"+19500"},{n:"Aaron Rai",o:"+19500"},
    {n:"Brian Harman",o:"+20000"},{n:"Sam Stevens",o:"+21000"},
    {n:"Sergio Garcia",o:"+22500"},{n:"Ryan Fox",o:"+22500"},
    {n:"Wyndham Clark",o:"+22500"},{n:"Max Greyserman",o:"+23000"},
    {n:"Dustin Johnson",o:"+24000"}]},
  {id:5,label:"Tier 5 \u2014 Deep Sleepers",lc:"tl5",chip:"ch5",golfers:[
    {n:"Casey Jarvis",o:"+25000"},{n:"Carlos Ortiz",o:"+26000"},
    {n:"Haotong Li",o:"+28000"},{n:"Tom McKibbin",o:"+28000"},
    {n:"Nico Echavarria",o:"+31000"},{n:"Kristoffer Reitan",o:"+31000"},
    {n:"Rasmus Neergaard-Petersen",o:"+32500"},{n:"John Keefer",o:"+34000"},
    {n:"Michael Kim",o:"+35000"},{n:"Andrew Novak",o:"+40000"},
    {n:"Aldrich Potgieter",o:"+41000"},{n:"Michael Brennan",o:"+43000"},
    {n:"Sami Valimaki",o:"+52500"},{n:"Davis Riley",o:"+60000"},
    {n:"Charl Schwartzel",o:"+60000"},{n:"Bubba Watson",o:"+60000"},
    {n:"Zach Johnson",o:"+60000"}]},
  {id:6,label:"Tier 6 \u2014 Legends",lc:"tl6",chip:"ch6",golfers:[
    {n:"Brian Campbell",o:"+250000"},{n:"Ethan Fang",o:"+250000"},
    {n:"Danny Willett",o:"+250000"},{n:"Vijay Singh",o:"+450000"},
    {n:"Mason Howell",o:"+450000"},{n:"Angel Cabrera",o:"+450000"},
    {n:"Brandon Holtz",o:"+500000"},{n:"Mike Weir",o:"+500000"},
    {n:"Fred Couples",o:"+500000"},{n:"Jose Maria Olazabal",o:"+500000"}]}
];

export var NAME_ALIASES = {
  "ludvig aberg":["ludvig aberg","ludvig \xe5berg"],
  "nicolai hojgaard":["nicolai hojgaard","nicolai h\xf8jgaard"],
  "rasmus hojgaard":["rasmus hojgaard","rasmus h\xf8jgaard"]
};
