window.addEventListener('load', () => {

  getRateLimit();

  initDT(); // Initialize the DatatTable and window.columnNames variables

  const repo = getRepoFromUrl();

  if (repo) {
    document.getElementById('q').value = repo;
    fetchData();
  }
});

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  fetchData();
});

function fetchData() {
  const repo = document.getElementById('q').value;
  const re = /[-_\w]+\/[-_.\w]+/;

  const urlRepo = getRepoFromUrl();

  if (!urlRepo || urlRepo !== repo) {
    window.history.pushState('', '', `#${repo}`);
  }

  if (re.test(repo)) {
    fetchAndShow(repo);
  } else {
    showMsg(
      'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;',
      'danger'
    );
  }
}

function updateDT(data) {
  // Remove any alerts, if any:
  if ($('.alert')) $('.alert').remove();

  var repo = cleanupRepoUrl(getRepoFromUrl());
  var repoOwner = repo.split("/")[0];
  
  // Format dataset and redraw DataTable. Use second index for key name
  const forks = [];
  for (let fork of data) {
    fork.repoLink = `<a href="https://github.com/${fork.full_name}">${fork.name}</a>`;
    fork.ownerName = fork.owner.login;
	
	fork.total_commits = `<span id="tc-${fork.full_name}">?</span>`;
	fork.ahead_by = `<span id="ab-${fork.full_name}">?</span>`;
	fork.behind_by = `<span id="bb-${fork.full_name}">?</span>`;
	
	fork.query = `<button type="button" class="qryDiff btn btn-secondary" data-repo="${fork.full_name}" data-base="${repoOwner}:${fork.default_branch}" data-head="${fork.ownerName}:${fork.default_branch}">Query</button>`;
	
    forks.push(fork);
  }
  const dataSet = forks.map(fork =>
    window.columnNamesMap.map(colNM => fork[colNM[1]])
  );
  window.forkTable
    .clear()
    .rows.add(dataSet)
    .draw();
}

function initDT() {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // [ 'Repository', 'full_name' ],
    //['Link', 'repoLink'], // custom key
    ['Owner', 'ownerName'], // custom key
    //['Name', 'name'],
    ['Name', 'repoLink'], // custom key
    ['Branch', 'default_branch'],
    ['Stars', 'stargazers_count'],
    ['Forks', 'forks'],
    ['Open Issues', 'open_issues_count'],
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
	['Created',	"created_at" ],
	['Updated', "updated_at" ],
	['Total Commits', "total_commits"],
	['Ahead by', "ahead_by" ],
	['Behind by', "behind_by" ],
	['Query', "query" ]
  ];

  // Sort by stars:
  const sortColName = 'Stars';
  const sortColumnIdx = window.columnNamesMap
    .map(pair => pair[0])
    .indexOf(sortColName);

  // Use first index for readable column name
  // we use moment's fromNow() if we are rendering for `pushed_at`; better solution welcome
  window.forkTable = $('#forkTable').DataTable({
    columns: window.columnNamesMap.map(colNM => {
      return {
        title: colNM[0],
        render:
          (colNM[1] === 'pushed_at' || colNM[1] === 'created_at' || colNM[1] === 'updated_at')
            ? (data, type, _row) => {
                if (type === 'display') {
                  return moment(data).format("YYYY-MM-DD"); // + "<br /> " + moment(data).fromNow();
                }
                return data;
              }
            : null,
      };
    }),
    order: [[sortColumnIdx, 'desc']],
  });
}

function cleanupRepoUrl(repo) {
  repo = repo.replace('https://github.com/', '');
  repo = repo.replace('http://github.com/', '');
  repo = repo.replace('.git', '');
  return repo;
}

function fetchAndShow(repo) {
  repo = cleanupRepoUrl(repo);

  fetch(
    `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=100`
  )
    .then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response.json();
    })
    .then(data => {
      console.log(data);
      updateDT(data);
	  getRateLimit();
    })
    .catch(error => {
      const msg =
        error.toString().indexOf('Forbidden') >= 0
          ? 'Error: API Rate Limit Exceeded'
          : error;
      showMsg(`${msg}. Additional info in console`, 'danger');
      console.error(error);
    });
}

function showMsg(msg, type) {
  let alert_type = 'alert-info';

  if (type === 'danger') {
    alert_type = 'alert-danger';
  }

  document.getElementById('footer').innerHTML = '';

  document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `;
}

function getRepoFromUrl() {
  const urlRepo = location.hash && location.hash.slice(1);

  return urlRepo && decodeURIComponent(urlRepo);
}

$("div.container").on("click", "button.qryDiff", function() {

	var $this = $(this);
	var repo = $this.data("repo");
	var base = $this.data("base");
	var head = $this.data("head");
	
	var url = `https://api.github.com/repos/${repo}/compare/${base}...${head}`;
	
	fetch(url)
    .then(response => {
      if (!response.ok) throw Error(response.statusText);
      return response.json();
    })
    .then(data => {
      console.log(data);
	  document.getElementById("tc-" + repo).innerText = (data.total_commits);
	  document.getElementById("ab-" + repo).innerText = (data.ahead_by);
	  document.getElementById("bb-" + repo).innerText = (data.behind_by);
	  getRateLimit();
    })
    .catch(error => {
      const msg =
        error.toString().indexOf('Forbidden') >= 0
          ? 'Error: API Rate Limit Exceeded'
          : error;
      showMsg(`${msg}. Additional info in console`, 'danger');
      console.error(error);
    });

});

function getRateLimit() {

	fetch("https://api.github.com/rate_limit")
		.then(response => {
		  if (!response.ok) throw Error(response.statusText);
		  return response.json();
		})
		.then(data => {
		  console.log(data);
		  document.getElementById("rateRemaining").innerText = (data.rate.remaining);
		  document.getElementById("rateLimit").innerText = (data.rate.limit);
		})
		.catch(error => {
		  const msg =
			error.toString().indexOf('Forbidden') >= 0
			  ? 'Error: API Rate Limit Exceeded'
			  : error;
		  showMsg(`${msg}. Additional info in console`, 'danger');
		  console.error(error);
		});
}
