const candidates = [
    null,
    null,
    { action: "move", target: [8, 7], score: 750 },
    null
];

candidates.sort(function(a, b) {
    return (b ? b.score : 0) - (a ? a.score : 0);
});

console.log("Sorted candidates:", candidates);
console.log("Chosen candidate:", candidates[0]);
