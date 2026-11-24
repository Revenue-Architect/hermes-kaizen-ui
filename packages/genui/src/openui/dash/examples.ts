// Checked example dashboards: the model guidance shows these and the tests validate and render them. The source
// names are placeholders for whatever the user lists; every figure comes from a read, defaults are zeros and lists.
export const dashboardExamples: Record<string, string> = {
  Sales: `root = Dashboard([header, section])
$stage = "all"
pipe = Query("crm.get_pipeline", {stage: $stage}, {asOf: "", totals: {open: 0, value: 0}, byStage: [], deals: []}, 300)
header = DashboardHeader("Sales pipeline", "As of " + pipe.asOf, [refresh])
refresh = IconButton("Refresh", "refresh-cw", null, Action([@Run(pipe)]), "tertiary")
filters = FilterBar([stageFilter])
stageFilter = FilterSelect("stage", "Stage", [{value: "all", label: "All stages"}, {value: "new", label: "New"}, {value: "won", label: "Won"}], $stage)
section = Section([kpis, charts, list], filters)
kpis = CardRow([openCard, valueCard])
openCard = SmallCard("Open deals", "" + pipe.totals.open)
valueCard = SmallCard("Open value", "$" + pipe.totals.value)
charts = CardRow([stageCard])
stageCard = LargeCard([DashboardCardHeader("Value by stage"), BarChart(pipe.byStage.stage, [Series("Value", pipe.byStage.value)])])
list = CardRow([dealsCard])
dealsCard = LargeCard([DashboardCardHeader("Deals"), Table([Col("Deal", pipe.deals.name), Col("Stage", pipe.deals.stage), Col("Value", pipe.deals.value, "number")])], true)`,

  Service: `root = Dashboard([header, section])
health = Query("status.get_health", {}, {asOf: "", services: []}, 120)
header = DashboardHeader("Service health", "As of " + health.asOf, [refresh])
refresh = IconButton("Refresh", "refresh-cw", null, Action([@Run(health)]), "tertiary")
section = Section([rows])
rows = CardRow([servicesCard])
servicesCard = LargeCard([DashboardCardHeader("Services"), Table([Col("Service", health.services.name), Col("Status", health.services.status), Col("Latency ms", health.services.latency, "number")])])`,
};
