import React from 'react';
import MinerGraph from '../components/MinerGraph';
import ValidatorScores from '../components/ValidatorScores';
import MinerMap from '../components/MinerMap';
import '../App.css';

const MinerDashboard = () => {
  return (
    <div className="app-container">
      <h1 id="v1" className="heading-3">Miner Loss</h1>
      <div className="graph-wrapper">
        <MinerGraph />
      </div>

      {/* <h1 id="v2" className="heading-3">V2 Validator Scores</h1>
      <div className="graph-wrapper">
        <ValidatorScores />
      </div>
      <p className="text-ibm">Coming soon...</p> */}
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>       
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>        

      <h1 id="v3" className="heading-3">Contributors</h1>
      <div>
        <MinerMap />
      </div>
      {/* <div className="graph-wrapper">
        <MinerMap />
      </div> */}
      <p className="text-ibm">Coming soon...</p>
    </div>
  );
};

export default MinerDashboard;
