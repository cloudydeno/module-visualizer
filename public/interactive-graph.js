window.CreateModuleGraph = function CreateModuleGraph(input) {
  var container = document.getElementById("graph");

  const data = vis.parseDOTNetwork(input);
  const seenNodes = new Map;
  for (const node of data.nodes) {
    const lines = node.label.split('\\l');
    lines[0] = `<b>${lines[0]}</b>`;
    node.label = lines.join('\n');

    node.borderWidth = parseFloat(node.width);
    node.width = undefined;

    seenNodes.set(node.id, node);
  }
  for (const edge of data.edges) {
    seenNodes.delete(edge.to);
  }
  console.log(seenNodes);

  const network = new vis.Network(container, data, {
    // layout: {
    //   hierarchical: {
    //     direction: 'LR',
    //   },
    // },
    nodes: {
      margin: {
        top: 0, right: 10, bottom: 0, left: 10,
      },
      font: {
        // size: 26,
        align: "left",
        multi: 'html',
      },
    },
    interaction: {
      hover: true,
    },
    physics: {
      forceAtlas2Based: {
        gravitationalConstant: -26,
        centralGravity: 0.005,
        springLength: 230,
        springConstant: 0.18,
      },
      maxVelocity: 146,
      solver: "forceAtlas2Based",
      timestep: 0.35,
      stabilization: {
        enabled: true,
        iterations: 2000,
        updateInterval: 25,
      },
    },
  });

  network.setSelection({
    nodes: Array.from(seenNodes.keys()),
    edges: [],
  });
  network.on("doubleClick", function (params) {
    const nodeId = params.nodes[0];
    if (!nodeId) return;
    const node = data.nodes.find(x => x.id === nodeId);
    if (!node) return;
    if (!node.href) return;
    var win = window.open(node.href, '_blank');
    win.focus();

    // params.event = "[original event]";
    // document.getElementById("eventSpanHeading").innerText =
    //   "doubleClick event:";
    // document.getElementById("eventSpanContent").innerText = JSON.stringify(
    //   params,
    //   null,
    //   4
    // );
  });

  //Get the canvas HTML element
  var networkCanvas = document
    .getElementById("graph")
    .getElementsByTagName("canvas")[0];
  function changeCursor(newCursorStyle) {
    networkCanvas.style.cursor = newCursorStyle;
  }
  network.on("hoverNode", function () {
    changeCursor("grab");
  });
  network.on("blurNode", function () {
    changeCursor("default");
  });
  network.on("hoverEdge", function () {
    changeCursor("grab");
  });
  network.on("blurEdge", function () {
    changeCursor("default");
  });
  network.on("dragStart", function () {
    changeCursor("grabbing");
  });
  network.on("dragging", function () {
    changeCursor("grabbing");
  });
  network.on("dragEnd", function () {
    changeCursor("grab");
  });
};
