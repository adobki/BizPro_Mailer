// HTML code used to build logs previewer webpage

// Define the top/header part of HTML
const htmlHeader = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Montserrat', 'Tahoma', sans-serif; }
      h1 { text-align: center; } table { width: 100%; }
      th { background-color: #000; color: #FFF; cursor: pointer; height: 3em; }
      tr:nth-child(even) { background-color: #48A; color: #FFF }
      .button { display: inline-block; background-color: #2c7be5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      .current { background-color: white; color: #2c7be5; }
      .levels { width: 100%; text-align: center; }
    </style>
    <title>{{ title }}</title>
  </head>
  <body><h1>{{ title }}</h1> <h3 class="levels">{{ levels }}</h3>
  <h3>Filter: <input type="text" id="tableFilter" placeholder="Type text to filter..." oninput="filterTable()"></h3>
  <table id="logsTable">{{ table }}</table>
`;

// Define the bottom/footer part of HTML
const htmlFooter = '</body></html>';

// Define JavaScript code used for page actions such as navigation, sorting, and filtering data
const htmlScripts = `
  <script>
    function sortTable(columnIndex) { // Table sorting function
      const table = document.getElementById("logsTable");
      const rows = Array.from(table.rows).slice(1);
      const ascending = table.rows[0].cells[columnIndex].classList.contains("asc");

      rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex].innerText;
        const cellB = rowB.cells[columnIndex].innerText;

        if (isNaN(cellA) || isNaN(cellB)) return ascending ? cellA.localeCompare(cellB)
          : cellB.localeCompare(cellA);
        else return ascending ? parseFloat(cellA) - parseFloat(cellB)
          : parseFloat(cellB) - parseFloat(cellA);
      }); rows.forEach(row => table.appendChild(row));

      if (ascending) table.rows[0].cells[columnIndex].classList.remove("asc");
      else table.rows[0].cells[columnIndex].classList.add("asc");
    }

    function filterTable() { // Table filtering function
      const filter = document.getElementById("tableFilter").value.toLowerCase();
      const table = document.getElementById("logsTable");
      const rows = table.getElementsByTagName("tr");

      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName("td");
        let rowVisible = false;

        for (let j = 0; j < cells.length; j++) {
          const cell = cells[j];
          if (cell.innerText.toLowerCase().includes(filter)) {
            rowVisible = true; break;
          }
        } rows[i].style.display = rowVisible ? "" : "none";
      }
    }
  </script>
`;

module.exports = { htmlHeader, htmlFooter, htmlScripts };
