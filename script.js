/*************************************************************
 * In this file, we integrate:
 *  - ArcGIS JavaScript APIs (Map, MapView, FeatureLayer, etc.)
 *  - OpenAI API calls
 *  - Additional features like filtering, highlighting, and
 *    dynamic chart updates based on AI instructions.
 *************************************************************/
require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/config",
    "esri/widgets/FeatureTable",
    "esri/widgets/Expand"
  ], function (Map, MapView, FeatureLayer, esriConfig, FeatureTable, Expand) {
  
    /*************************************
     * 1. Configure your ArcGIS API key
     *************************************/
    esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurM0EeiONV7zZrXNPTHTXY62YqzQDvmmQlr9ExzYxIsXdI0lJPyKjZYC3CrgNZokrC-5CbFUHEGkogHPdxs_KXpxAP9YGK6XNcVM2l_e_STkzG2yF8wKs5Pj9yCyaVBVo3PXpVCIyYBu1SQEgG-tmQoV7TkisyszxCgvQdjF97LCLxApSaGc0SmDWBTHj56ThniEQzdv2S0P3NCGQKcZ96GM-9kvIoqyG8ncYrs8QhTSUSvVFc_rfVllTR1VVnyrZ1Q..AT1_W9c6GaEx"; // Replace with your actual API key
  
    /*************************************
     * 2. Create a map
     *************************************/
    const map = new Map({
      basemap: "arcgis-topographic"
    });
  
    /*************************************
     * 3. Create a MapView
     *************************************/
    const view = new MapView({
      container: "viewDiv",
      map: map,
      center: [-86.7816, 36.1627], // approximate center
      zoom: 7
    });
  
    /*************************************
     * 4. Add the FeatureLayer
     *************************************/
    const placesLayer = new FeatureLayer({
      url: "https://services7.arcgis.com/5ntOKzUtngY47IXY/arcgis/rest/services/hypertension_digital_report_layer_county/FeatureServer",
      popupTemplate: {
        title: "{NAME} County",
        content: `
          <ul>
            <li><b>Data Year:</b> {data_year}</li>
            <li><b>Median Age:</b> {Median_Age}</li>
            <li><b>Total Population:</b> {Total_Population}</li>
          </ul>
        `
      }
    });
    map.add(placesLayer);
  
    /*************************************
     * 4a. (Optional) Add a FeatureTable
     *************************************/
    const featureTable = new FeatureTable({
      view: view,
      layer: placesLayer,
      container: document.createElement("div"),
      fieldConfigs: [
        { name: "NAME", label: "County" },
        { name: "data_year", label: "Data Year" },
        { name: "Median_Age", label: "Median Age" },
        { name: "Total_Population", label: "Population" }
      ]
    });
  
    const expandTable = new Expand({
      view: view,
      content: featureTable.domNode,
      expanded: false,
      expandIconClass: "esri-icon-table",
      group: "top-left"
    });
    view.ui.add(expandTable, "top-left");
  
    /********************************************************
     * Global references for highlights and Chart.js
     ********************************************************/
    let highlightHandle = null;
    let myChart = null; // We'll store our Chart.js instance here
  
    /********************************************************
     * 5. Handle AI Prompt Submission
     ********************************************************/
    window.handlePrompt = function () {
      const userQuestion = document.getElementById("userPrompt").value;
      if (!userQuestion) {
        alert("Please enter a question before submitting.");
        return;
      }
  
      // Create a query for a subset of features
      const queryObj = placesLayer.createQuery();
      queryObj.outFields = ["*"];
      queryObj.returnGeometry = true; // so we can highlight on the map
  
      placesLayer
        .queryFeatures(queryObj)
        .then((response) => {
          const features = response.features;
          if (!features.length) {
            alert("No features returned. Try adjusting your query or zoom level.");
            return;
          }
  
          // Summarize the features (just a small sample of data)
          const featureSummaries = features
            .map((f) => {
              const attr = f.attributes;
              return `County: ${attr.NAME}, Data year: ${attr.data_year}, Value: ${attr.Median_Age} ${attr.Total_Population}`;
            })
            .join("\n");
  
          // Construct prompt for OpenAI
          const promptText = `
  You are an assistant with expert knowledge in local health data.
  Here is a sample of the data we have:
  
  ${featureSummaries}
  
  The user asks: ${userQuestion}
  Please provide an answer based on the data shown above, and if you need additional context, indicate what is missing.
          `.trim();
  
          // Send the prompt to OpenAI
          // const openAiApiKey = "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"; // Replace with your actual OpenAI key
          const openAiApiKey = "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";
  
          fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiApiKey}`
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                { role: "system", content: "You are an assistant with expert knowledge in local health data." },
                { role: "user", content: promptText }
              ],
              max_tokens: 200,
              temperature: 0.7
            })
          })
            .then((res) => res.json())
            .then((data) => {
              console.log("OpenAI raw response:", data);
              if (data.error) {
                alert(`Error from OpenAI: ${data.error.message}`);
                return;
              }
  
              const aiResponse = data?.choices?.[0]?.message?.content?.trim() || "";
              alert(`AI Response:\n\n${aiResponse}`);
  
              // Display AI response in responseContainer
              const responseContainer = document.getElementById("responseContainer");
              responseContainer.innerText = aiResponse;
  
              // 5a. Parse out county names for highlighting/filtering
              highlightCountiesFromResponse(aiResponse);
  
              // 5b. Look for instructions about "top X counties by some_attribute"
              parseAndUpdateChartFromAI(aiResponse);
  
            })
            .catch((err) => console.error("OpenAI API Error:", err));
        })
        .catch((err) => {
          console.error("Error querying features:", err);
          alert("Error querying features. Check the console for details.");
        });
    };
  
    /********************************************************
     * 6. Highlight Counties Mentioned by AI (Partial Matching)
     ********************************************************/
    async function highlightCountiesFromResponse(aiResponse) {
      if (highlightHandle) {
        highlightHandle.remove();
      }
  
      // Extract any counties from lines like "County: <something>"
      const countyRegex = /County:\s*([^,\n]+)/gi;
      let match;
      const rawCounties = [];
      while ((match = countyRegex.exec(aiResponse)) !== null) {
        rawCounties.push(match[1].trim());
      }
  
      if (!rawCounties.length) {
        console.log("No counties found in the AI response for highlighting.");
        return;
      }
  
      // Clean up extracted county names and remove trailing " - ..." or " County" if needed
      // Then we'll do partial matching in the layer
      const cleanedCounties = rawCounties.map((rc) => {
        // remove anything after a dash
        let c = rc.split("-")[0].trim();
        // if AI returned "Pickett County", but your data only has "Pickett":
        // remove a trailing " County" if it exists
        c = c.replace(/ county$/i, "").trim();
        return c;
      });
  
      console.log("Counties mentioned in AI response (cleaned):", cleanedCounties);
  
      // Build a partial matching WHERE clause with OR conditions:
      // e.g. UPPER(NAME) LIKE '%PICKETT%' OR UPPER(NAME) LIKE '%CUMBERLAND%'
      const whereParts = cleanedCounties.map((cc) => {
        const sanitized = cc.replace(/'/g, "''"); // escape single quotes
        return `UPPER(NAME) LIKE '%${sanitized.toUpperCase()}%'`;
      });
      const finalWhere = whereParts.join(" OR ");
  
      placesLayer.definitionExpression = finalWhere;
      console.log("Definition Expression:", finalWhere);
  
      // Query those counties to highlight and zoom
      try {
        const queryObj = placesLayer.createQuery();
        queryObj.where = finalWhere;
        queryObj.returnGeometry = true;
        queryObj.outFields = ["*"];
  
        const result = await placesLayer.queryFeatures(queryObj);
        if (result.features.length) {
          console.log("Features to highlight:", result.features.map(f => f.attributes.NAME));
          view.goTo(result.features);
          const layerView = await view.whenLayerView(placesLayer);
          highlightHandle = layerView.highlight(result.features);
        }
      } catch (err) {
        console.error("Error highlighting counties:", err);
      }
    }
  
    /********************************************************
     * 7. Make the Chart Dynamic Based on AI instructions
     ********************************************************/
    function parseAndUpdateChartFromAI(aiResponse) {
      // We'll look for a pattern: "top <number> counties by <attribute>"
      const topCountyRegex = /top\s*(\d+)\s*counties\s*by\s*([\w_]+)/i;
      const match = aiResponse.match(topCountyRegex);
  
      if (!match) {
        console.log("No 'top X counties by Y' pattern found in AI response. No chart update.");
        return;
      }
  
      const topCount = parseInt(match[1], 10);
      const attribute = match[2]; // e.g., "Median_Age", "Total_Population", etc.
  
      // Validate or fallback
      const validFields = ["Median_Age", "Total_Population"]; 
      const sortField = validFields.includes(attribute) ? attribute : "Total_Population";
      const finalCount = Number.isNaN(topCount) ? 5 : topCount;
  
      // Query the layer to get top X by that attribute
      const queryObj = placesLayer.createQuery();
      queryObj.returnGeometry = false;
      queryObj.outFields = ["NAME", sortField];
      queryObj.orderByFields = [`${sortField} DESC`];
      queryObj.num = finalCount;
  
      placesLayer.queryFeatures(queryObj).then((res) => {
        const feats = res.features;
        if (!feats.length) return;
  
        const labels = feats.map((f) => f.attributes.NAME);
        const dataVals = feats.map((f) => f.attributes[sortField]);
  
        updateChartData(labels, dataVals, `Top ${finalCount} by ${sortField}`);
      });
    }
  
    /********************************************************
     * 7a. Update the Chart.js Data
     ********************************************************/
    function updateChartData(labels, values, title = "Dynamic Data") {
      if (!myChart) {
        console.log("Chart not initialized yet. Cannot update.");
        return;
      }
      myChart.data.labels = labels;
      myChart.data.datasets[0].data = values;
      myChart.data.datasets[0].label = title;
      myChart.update();
    }
  
    /********************************************************
     * 8. Filter: by minimum population
     ********************************************************/
    window.applyMinPopulationFilter = function () {
      const minPop = document.getElementById("minPop").value;
      if (!minPop || isNaN(minPop)) {
        alert("Please enter a valid numeric value for minimum population.");
        return;
      }
      placesLayer.definitionExpression = `Total_Population >= ${minPop}`;
    };
  
    /********************************************************
     * 9. Reset definition expression
     ********************************************************/
    window.resetDefinitionExpression = function () {
      placesLayer.definitionExpression = "1=1";
      document.getElementById("minPop").value = "";
    };
  
    /********************************************************
     * 10. Initialize the chart (once the layer is ready)
     *     We'll show top 5 counties by total population.
     ********************************************************/
    placesLayer.when(() => {
      const queryObj = placesLayer.createQuery();
      queryObj.returnGeometry = false;
      queryObj.outFields = ["NAME", "Total_Population"];
      queryObj.orderByFields = ["Total_Population DESC"];
      queryObj.num = 5;
  
      placesLayer.queryFeatures(queryObj).then((res) => {
        const topFeatures = res.features;
        if (!topFeatures.length) return;
  
        const labels = topFeatures.map((f) => f.attributes.NAME);
        const dataVals = topFeatures.map((f) => f.attributes.Total_Population);
  
        // Initialize Chart.js on the <canvas> element
        const ctx = document.getElementById("myChart").getContext("2d");
        myChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Top 5 by Population",
                data: dataVals,
                backgroundColor: "rgba(75, 192, 192, 0.5)"
              }
            ]
          },
          options: {
            responsive: false,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      });
    });
  });
  