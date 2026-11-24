import { IMG_DUSK, IMG_MOSS, IMG_SKY } from './example-images';

/** Offline example programs for the published openuiLibrary. All data is synthetic and labelled as such. */
export const libraryExamples: Record<string, string> = {
  'Overview': `root = Stack([hero, kpis, facts, notes, snippet, divider, code])
hero = Card([CardHeader("Weekend planner", "Example data, not a live report"), TextContent("A compact **workspace** overview using the published *openuiLibrary*, themed to match Hermes.", "default"), TagBlock(["Example", "Same chat", "Local controls"], "sm")])
kpis = OverviewCardBlock([k1, k2, k3], "grid")
k1 = OverviewCardItem("time", IconText(Icon("clock", "time"), "info", "m", "Time saved", "Example this week"), MetricIndicatorInline("2.4 h", "vs last week", {direction: "up", value: 12}))
k2 = OverviewCardItem("score", IconText(Icon("gauge", "analytics"), "success", "m", "Readiness", "Example score"), MetricIndicatorInline("86", "of 100", {direction: "up", value: 4}))
k3 = OverviewCardItem("risk", IconText(Icon("triangle-alert", "alerts"), "warning", "m", "Open risks", "Example count"), MetricIndicatorInline("3", "two minor", {direction: "down", value: 8}))
facts = Card([InlineHeader("Useful context", "Entity list and callouts"), EntityList([{left: "Mode", right: "Example gallery"}, {left: "Renderer", right: "openuiLibrary"}, {left: "Transport", right: "Existing Hermes chat"}], "default"), Callout("info", "Example only", "No live services were assessed."), TextCallout("success", "Ready", "Everything here is local and safe to explore.")])
notes = Card([InlineHeader("Notes"), MarkDownRenderer("- Cards, tables and charts follow the red accent\n- Light and dark follow Desktop\n- Nothing sends until you click a chat button", "clear")], "sunk")
snippet = SnippetCardBlock([SnippetCardItem("a", IconText(Icon("book-open", "education"), "info", "m", "Reading", "At home"), BoldText("number", "$0")), SnippetCardItem("b", IconText(Icon("landmark", "travel"), "neutral", "m", "Museum", "Admission"), BoldText("number", "$20"))], "grid")
divider = Separator("horizontal", true)
code = CodeBlock("typescript", "const answer = 42;\nconsole.log(answer);")`,

  'Charts': `root = Stack([intro, row1, line, area, row2, scatter])
intro = CardHeader("See the pattern", "All values below are examples")
row1 = Stack([bar, hbar], "row", "m", "stretch", "start", true)
bar = Card([InlineHeader("Costs", "CAD, example"), BarChart(["Reading", "Museum", "Lunch"], [Series("Cost", [0, 20, 15])], "grouped", "Plan", "CAD")])
hbar = Card([InlineHeader("Ranked", "Example"), HorizontalBarChart(["Quebec", "Tremblant", "Townships"], [Series("Hours", [2.75, 1.5, 1.5])], "grouped")])
line = Card([InlineHeader("Weekly trend", "Example items"), LineChart(["Mon", "Tue", "Wed", "Thu"], [Series("Done", [12, 24, 18, 32]), Series("Planned", [10, 20, 22, 28])], "natural", "Day", "Items")])
area = Card([InlineHeader("Volume", "Example units"), AreaChart(["A", "B", "C", "D"], [Series("Units", [10, 22, 30, 26])], "natural")])
row2 = Stack([pie, radar, radial, stacked], "row", "m", "stretch", "start", true)
pie = Card([InlineHeader("Mix"), PieChart(["A", "B", "C"], [4, 3, 2], "donut")])
radar = Card([InlineHeader("Profile"), RadarChart(["Speed", "Cost", "Comfort", "Scenery"], [Series("Option", [4, 3, 5, 4])])])
radial = Card([InlineHeader("Share"), RadialChart(["Build", "Review", "Rest"], [3, 2, 1])])
stacked = Card([InlineHeader("Time split"), SingleStackedBarChart(["Build", "Review", "Rest"], [3, 2, 1])])
scatter = Card([InlineHeader("Distribution", "Example points"), ScatterChart([ScatterSeries("Group A", [Point(1, 2), Point(2, 4), Point(3, 3)]), ScatterSeries("Group B", [Point(2, 1), Point(3, 5), Point(4, 4)])], "x", "y")])`,

  'Forms': `root = Stack([header, form])
header = CardHeader("Make a choice", "Edits stay local; only the explicit button sends to Hermes")
form = Form("prefs", actions, [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11])
f1 = FormControl("Name", Input("name", "Example name", "text"))
f2 = FormControl("Notes", TextArea("notes", "What matters to you?", 3))
f3 = FormControl("Activity", Select("activity", [SelectItem("reading", "Reading"), SelectItem("museum", "Museum")], "Choose one"))
f4 = FormControl("Date", DatePicker("date", "single"))
f5 = FormControl("Duration (hours)", Slider("duration", "discrete", 1, 8, 1, [2]))
f6 = FormControl("Extras", CheckBoxGroup("extras", [CheckBoxItem("Lunch", "Add a lunch stop", "lunch", true), CheckBoxItem("Taxi", "Book a ride home", "taxi", false)]))
f7 = FormControl("Pace", RadioGroup("pace", [RadioItem("Relaxed", "Plenty of breaks", "relaxed"), RadioItem("Busy", "See more", "busy")], "relaxed"))
f8 = FormControl("Preferences", SwitchGroup("prefs", [SwitchItem("Quiet places", "Avoid crowds", "quiet", true), SwitchItem("Outdoors", "Prefer fresh air", "outdoors", false)], "clear"))
f9 = FormControl("Interests", Chips("interests", "multiple", [ChipItem("art", "Art", Icon("palette", "design")), ChipItem("books", "Books", Icon("book", "education")), ChipItem("food", "Food", Icon("utensils", "food"))], {}, ["books"]))
f10 = FormControl("Style", OptionCards("style", "single", [OptionCard("calm", "Calm", "Slow mornings", Icon("sun", "weather")), OptionCard("active", "Active", "Lots to do", Icon("zap", "energy"))], {}, "calm"))
f11 = FormControl("Label", Label("A plain label component"))
actions = Buttons([Button("Plan this in chat", @ToAssistant("Use these form values to suggest an example weekend plan. Do not book, send or schedule anything."), "primary"), Button("Just reset the note", @Reset($note), "secondary")])
$note = "Keep it relaxed."`,

  'Layout and navigation': `root = Stack([tabs, acc, steps, carousel, modalRow, tableCard, editable])
tabs = Tabs([TabItem("plan", "Plan", [TextContent("Tabs are local: switching never sends anything."), Steps([StepsItem("Prepare", "Example material"), StepsItem("Review", "Example decision")])]), TabItem("notes", "Notes", [Callout("neutral", "Local", "Only the view changes.")])])
acc = Accordion([AccordionItem("one", "What changes?", [TextContent("Only the local view.")]), AccordionItem("two", "What sends?", [TextContent("An explicit chat button.")])])
steps = Steps([StepsItem("Start", "Open the plan"), StepsItem("Refine", "Adjust the details"), StepsItem("Finish", "Confirm in chat")])
carousel = Carousel([[Card([CardHeader("First", "Example page"), TextContent("Keyboard-friendly controls.")])], [Card([CardHeader("Second", "Example page"), TextContent("No request was sent.")])]], "card")
modalRow = Stack([Button("Open details", @Set($showModal, true), "secondary"), Modal("Local details", $showModal, [TextContent("This modal is local. Closing it sends nothing."), Button("Close", @Set($showModal, false), "primary")], "sm")], "row", "m")
$showModal = false
tableCard = Card([InlineHeader("Table", "Column-oriented"), Table([Col("Option", opts), Col("Cost", costs, "number"), Col("Note", notes)])])
opts = ["Reading", "Museum", "Lunch"]
costs = [0, 20, 15]
notes = ["At home", "Admission", "Example"]
editable = Card([InlineHeader("Editable table", "Edits stay local until Save Changes"), EditableTable("roster", [{type: "text", key: "name", header: "Name"}, {type: "select", key: "role", header: "Role", options: [{value: "eng", label: "Engineering"}, {value: "design", label: "Design"}]}, {type: "date-single", key: "start", header: "Start"}], [{id: "1", values: ["Alex Example", "eng", "2026-10-01"]}, {id: "2", values: ["Sam Example", "design", "2026-10-15"]}])])`,

  'Cards and lists': `root = Stack([ctx, comp, vis, list, buttons])
ctx = ContextCardBlock([ContextCardItem("a", "Context", "A short **bold** body for this example.", "gray"), ContextCardItem("b", Tag("Example", Icon("info", "info"), "sm", "info"), "A second tinted card.", "gray")], "grid")
comp = CompositeCardBlock([CompositeCardItem("one", IconText(Icon("package", "shopping"), "neutral", "m", "Plan A", "Example", true, "horizontal"), [MetricIndicatorInline("2,410", "Example units", {direction: "up", value: 12}), TagBlock(["Example"], "sm")], {price: BoldText("text", "$29"), button: Button("Details", @ToAssistant("Show details for Plan A, an example."), "secondary")}), CompositeCardItem("two", IconText(Icon("box", "shopping"), "neutral", "m", "Plan B", "Example", true, "horizontal"), [MetricIndicatorInline("980", "Example units", {direction: "down", value: 4})], {price: BoldText("text", "$14"), button: Button("Details", @ToAssistant("Show details for Plan B, an example."), "secondary")})], "grid")
vis = VisualCardBlock([VisualCardItem(BoldText("text", "Sky"), "sky", "${IMG_SKY}", Tag("Example", Icon("image", "media"), "sm", "neutral"), "Synthetic sky image"), VisualCardItem(BoldText("text", "Dusk"), "dusk", "https://example.invalid/missing.png", Tag("Missing", Icon("image-off", "media"), "sm", "warning"), "This image cannot load, so the alt text shows")], "grid")
list = ListBlock([ListItem("Reading", "At home", {src: "${IMG_MOSS}", alt: "Moss"}, "Open", @ToAssistant("Tell me more about reading, as an example.")), ListItem("Museum", "Admission", {src: "${IMG_DUSK}", alt: "Dusk"})], "image")
buttons = Buttons([Button("Ask in chat", @ToAssistant("Reply with the word confirmed."), "primary"), Button("Secondary", @ToAssistant("Reply with the word secondary."), "secondary"), Button("Delete", @ToAssistant("Pretend to delete an example."), "primary", "destructive"), IconButton("Refresh", Icon("refresh-cw", "arrows"), @ToAssistant("Refresh the example."), "tertiary", "medium", "circle"), Button("Open link", @OpenUrl("https://example.com"), "tertiary")], "row")`,

  'Images': `root = Stack([intro, one, block, gallery, text, large])
intro = CardHeader("Images", "https, http, data:image and MEDIA: artifacts load; anything else shows its alt text")
one = Image("Synthetic sunrise", "${IMG_DUSK}")
block = ImageBlock("${IMG_SKY}", "Synthetic sky")
gallery = ImageGallery([{src: "${IMG_SKY}", alt: "Sky", details: "Example image one"}, {src: "${IMG_MOSS}", alt: "Moss", details: "Example image two"}, {src: "javascript:alert(1)", alt: "Rejected scheme shows as alt text"}])
text = ImageText("${IMG_MOSS}", "Moss", "Small image", "Thumbnail with text", true, "horizontal")
large = ImageTextLarge("${IMG_DUSK}", "Dusk", "Banner image", "A full-width banner with a bold title")`,

  'Extras': `root = Stack([overview, offer, slice])
overview = OverviewCardBlock([OverviewCardItem("a", Text("text", "Plain text heading", "Example subtext", "text", "md"), MetricIndicatorInline("12", "units")), OverviewCardItem("b", Text("text", "Another heading"), MetricIndicatorInline("7", "units"))], "grid")
offer = CompositeCardBlock([CompositeCardItem("p1", Text("text", "Offer one"), [Text("number", "42", "Example", "metric", "sm")], {price: MetricIndicatorWithStrikethrough("$19", "per month", "$29", {direction: "down", value: 34})}), CompositeCardItem("p2", Text("text", "Offer two"), [Text("text", "Plain body")], {price: BoldText("text", "$9")})], "grid")
slice = Slice("Example slice", 3)`,
};
