import React, {Component} from 'react';
import { ipcRenderer } from 'electron';
import socketIOClient from 'socket.io-client';
import {NotificationContainer, NotificationManager} from 'react-notifications';
/*import './css/App.css';
import './css/bootstrap.min.css';*/
import ChartBar from './components/Chart';
import {Bar} from "react-chartjs-2";
import stress from './testData/Stress.json';
import load from './testData/CognitiveLoad.json';
import lucidity from './testData/Lucidity.json';

let socket = null;

export default class App extends Component {
    constructor(props){
        super(props);

        
        let app_config = ipcRenderer.sendSync('get-app-config');

        this.startTimeHour = app_config && (app_config.dayStartHour || app_config.dayStartHour===0) ? app_config.dayStartHour : 9;
        this.endTimeHour = app_config && (app_config.dayEndHour || app_config.dayEndHour===0) ? app_config.dayEndHour : 18;
        this.prevDaysCount = app_config && app_config.prevDaysCount ? app_config.prevDaysCount : 0;
        this.isPerfomanceStacked = app_config && app_config.perfomanceStacked ? true : false;
        this.tokenVal = ipcRenderer.sendSync('get-curr-access-token');

        console.log('Access token: ', this.tokenVal);

        this.state = {
            clientId: '',
            redirectUri: '',
            stateVal: '',
            labels: [],
            chartsData: {},
            prevDaysChartsData: {},
            startDate: new Date(),
            selectedType: 'currDay'
        };

        this.getLabel = this.getLabel.bind(this);
        this.formatData = this.formatData.bind(this);
        this.initData = this.initData.bind(this);
        this.getChartData = this.getChartData.bind(this);
        this.getDataByTimeout = this.getDataByTimeout.bind(this);
        this.updateData = this.updateData.bind(this);
        this.getPreviousDayData = this.getPreviousDayData.bind(this);
        this.lastHour = -1;
        this.lastMinutes = -1;
        this.background = {
            stress: [255, 7, 7],
            cognitiveLoad: [140,140,140],
            lucidity: [0, 204, 255],
            performance: [1, 187, 0],
            in_range: [71, 0, 212]
        };

        ipcRenderer.on('new-access-token', (event, arg)=>{
           console.log('ARG: ', arg);
        });
    }

    getDateTimeStr(hour, minute, date){
        if(!date){
            date = new Date();
        }
        return this.getDateKey(date.getFullYear(), date.getMonth(), date.getDate())+'T'+this.getTimeKey(hour, minute)+':00';
    }

    componentDidMount() {
        console.log('DID MOUNT');
        let self = this;
        let currDateTime = new Date();
        let currHour = currDateTime.getHours();
        let currMinute = currDateTime.getMinutes();
        let timeCond = `Start=${this.getDateTimeStr(this.startTimeHour, 0)}&Stop=${this.getDateTimeStr(currHour, currMinute)}`;
        let startData = this.initData(currHour, currMinute);
        this.updateData(startData, timeCond, 'chartsData')
            .then(result=>{
                console.log(result);
                self.getDataByTimeout(true);
            }, err=>{
                console.log('DID MOUNT ERROR: ', err);
            });
        if(this.prevDaysCount){
            let currDate = new Date();
            while(this.prevDaysCount>0){
                this.getPreviousDayData(currDate);
                this.prevDaysCount--;
            }
        }

        socket = socketIOClient.apply(this, ['http://localhost:8180']);
        socket.on('NewToken', result=>{
            console.log('NEW TOKEN DATA: ', result);
            this.tokenVal = result.token;
            let expires_in = result.expires_in*1000;
            setTimeout(()=>{
                let link = document.getElementById('updateTokenLink');
                link.href = result.auth_url;
                link.click();
            }, expires_in);
        });
    }

    updateData(currData, timeCond, stateKey){
        let self = this;
        return new Promise((resolve, reject)=>{
            Promise.all([
                this.getChartData(`/chart_data?${timeCond}&Group=feedback&Class=trigger-negative&Kind=Stress_Flag`),
                this.getChartData(`/chart_data?${timeCond}&Group=feedback&Class=trigger-negative&Kind=CognitiveLoad_Flag`),
                this.getChartData(`/chart_data?${timeCond}&Group=bio&Class=mental&Kind=Lucidity_Avg`)
            ]).then(result=>{
                console.log('RESULT: ', result);
                let stressData = result[0].data;
                let cognitiveLoadData = result[1].data;
                let lucidityData = result[2].data;
                self.formatData(stressData, currData, 'stress', stateKey==='prevDaysChartsData');
                self.formatData(cognitiveLoadData, currData, 'cognitiveLoad', stateKey==='prevDaysChartsData');
                self.formatData(lucidityData, currData, 'lucidity', stateKey==='prevDaysChartsData');
                self.setState({
                    [stateKey]: currData
                });
                resolve('Data updated');
            }, err=>{
                NotificationManager.error(err.message, 'Error', 5000);
                reject(err);
            });
        });
    }

    getPreviousDayData(currDate){
        currDate.setDate(currDate.getDate()-1);
        let key = this.getDateKey(currDate.getFullYear(), currDate.getMonth(), currDate.getDate());
        console.log('KEY=', key);
        let newData = this.state.prevDaysChartsData;
        newData[key] = {};
        let timeCond = `Start=${this.getDateTimeStr(this.startTimeHour, 0, currDate)}&Stop=${this.getDateTimeStr(this.endTimeHour, 0, currDate)}`;
        console.log(timeCond);
        this.updateData(newData, timeCond, 'prevDaysChartsData')
            .then(result=>{
                console.log('Success prev day data update: ', result);
            }, err=>{
                console.log('Prev day data update ERROR: ', err);
            });
    }

    increaseTimeKey(){
        if(this.lastMinutes<40){
            this.lastMinutes+=20;
        }else{
            this.lastHour++;
            this.lastMinutes=this.lastMinutes+20-60;
        }
    }

    getDataByTimeout(afterInit){
        let timeout = 20*60*1000;
        let self = this;
        if(afterInit){
            let currDateTime = new Date();
            let currHour = currDateTime.getHours();
            let currMinutes = currDateTime.getMinutes();
            timeout = (currHour < this.lastHour && this.lastMinutes===0 ? 60 - currMinutes : (currHour === this.lastHour && this.lastMinutes>currMinutes ? this.lastMinutes - currMinutes: 20))*60*1000;
        }
        setTimeout(()=>{
            let newChartsData = self.state.chartsData;
            let key = this.getTimeKey(self.lastHour, self.lastMinutes);
            newChartsData[key] = {};
            let timeCond = `Start=
            ${self.getDateTimeStr(self.lastMinutes===0 ? self.lastHour-1 : self.lastHour, self.lastMinutes===0 ? 40 : self.lastMinutes - 20)}
            &Stop=
            ${self.getDateTimeStr(self.lastHour, self.lastMinutes)}`;
            self.updateData(newChartsData, timeCond, 'chartsData')
                .then(result=>{
                    console.log(result);
                    onTimeout();
                }, err=>{
                    console.log(err);
                    onTimeout();
                });
        }, timeout);

        function onTimeout() {
            self.increaseTimeKey();
            if(self.lastHour < self.endTimeHour || self.lastHour === self.endTimeHour && self.lastMinutes===0) {
                self.getDataByTimeout(false);
            }else{
                setTimeout(()=>{
                    self.getPreviousDayData(new Date());
                    self.getDataByTimeout(false);
                },(24-self.endTimeHour+self.startTimeHour)*60*60*1000);
            }
        }
    }

    getChartData(url){
        return new Promise((resolve, reject)=>{
            fetch(url)
                .then(response=>{
                    if(response.status!==200) throw new Error(response.statusText);
                    console.log(response);
                    return response.json()
                })
                .then(res=>{
                    resolve(res);
                })
                .catch(err=>{
                    reject(err);
                })
        });
    }

    initData(currHour, currMinutes){
        let res = {};
        let hour = this.startTimeHour;
        let minutes = 20;
        let endHour = this.endTimeHour;
        while((hour < currHour || (hour === currHour&& minutes < currMinutes)) && hour < endHour) {
            let key = this.getTimeKey(hour, minutes);
            res[key] = {};
            if(minutes+20 >= 60){
                hour++;
                minutes=0;
            }else{
                minutes+=20;
            }
        }
        this.lastHour = hour;
        this.lastMinutes = minutes;
        return res;
    }

    getTimeKey(hour, minute){
        return (hour<10 ? '0'+hour : hour) + ':' + (minute<10 ? '0'+minute : minute);
    }

    getDateKey(year, month, day){
        return year+'-'+(month+1<10 ? '0'+(month+1) : month+1)+'-'+(day<10 ? '0'+day : day);
    }

    getLabel(){
        let currDate = new Date();
        let minutes = currDate.getMinutes();
        let seconds = currDate.getSeconds();
        return (minutes<10 ? '0'+minutes : minutes) + ':' + (seconds<10 ? '0'+seconds : seconds);
    }

    fakeData(){
        let values = [0,1,-2];
        let randomVal = values[Math.floor(Math.random() * values.length)];
        let currDate = new Date();
        let td = this.getDateKey(currDate.getFullYear(), currDate.getMonth(), currDate.getDate())+'T'+this.getTimeKey(currDate.getHours(), currDate.getMinutes());
        return [{
            "data": `{\"s\": [{\"c\": 0, \"d\": -0.5413542847002053, \"t\": 2002.2506371, \"v\": ${randomVal}}], \"t\": \"${td}\"}`
        }]
    }

    formatData(data, chartsData, type, isPrevDay){
        data.forEach(item=>{
            let iObj = JSON.parse(item.data);
            let recDate = new Date(iObj.t);
            let recHour = recDate.getMinutes()<40 ? recDate.getHours() : recDate.getHours()+1;
            let recMinutes = recDate.getMinutes()<20 ? 20 : (recDate.getMinutes()<40 ? 40 : 0);
            let key = this.getTimeKey(recHour, recMinutes);
            if(isPrevDay){
                key = this.getDateKey(recDate.getFullYear(), recDate.getMonth(), recDate.getDate());
            }
            for(let i=0; i<iObj.s.length; i++){
                if(iObj.s[i].v !== -2){
                    if(chartsData[key]) {
                        if (!chartsData[key][type]) chartsData[key][type] = {val: 0, count: 0};
                        chartsData[key][type].val += iObj.s[i].v;
                        chartsData[key][type].count++;
                    }
                }
                //работоспособность
                if(iObj.s[i].v === 0 || iObj.s[i].v === -2){
                    if(chartsData[key]) {
                        if (!chartsData[key]['performance']) chartsData[key]['performance'] = {count: 0};
                        chartsData[key]['performance'].count++;
                    }
                }else if(iObj.s[i].v === 1){
                    //for stacked chart
                    if(chartsData[key]) {
                        if (!chartsData[key]['in_range']) chartsData[key]['in_range'] = {count: 0};
                        chartsData[key]['in_range'].count++;
                    }
                }
            }
        });
    }



    render(){
        const {clientId, redirectUri, stateVal, tokenVal, labels, stressData, lucidityData, cognitiveLoadData, courageData, chartsData, prevDaysChartsData, selectedType} = this.state;
        let chartsLabels = [];
        let stressChartData = [];
        let cognitiveLoadChartData = [];
        let lucidityChartData = [];
        let performanceChartData = [];
        //for stacked chart
        let inRangeChartData = [];
        if(selectedType === 'currDay') {
            //curr day data format
            for (let key in chartsData) {
                chartsLabels.push(key);
                if (chartsData[key].stress) {
                    stressChartData.push(Math.round(chartsData[key].stress.val / chartsData[key].stress.count));
                } else {
                    stressChartData.push(0);
                }
                if (chartsData[key].cognitiveLoad) {
                    cognitiveLoadChartData.push(Math.round(chartsData[key].cognitiveLoad.val / chartsData[key].cognitiveLoad.count));
                } else {
                    cognitiveLoadChartData.push(0);
                }
                if (chartsData[key].lucidity) {
                    lucidityChartData.push(Math.round(chartsData[key].lucidity.val / chartsData[key].lucidity.count));
                } else {
                    lucidityChartData.push(0);
                }
                if (chartsData[key].performance) {
                    performanceChartData.push(chartsData[key].performance.count);
                } else {
                    performanceChartData.push(0);
                }
                if (chartsData[key].in_range) {
                    inRangeChartData.push(chartsData[key].in_range.count);
                } else {
                    inRangeChartData.push(0);
                }

            }
        }else {
            //prev days data format
            for (let key in prevDaysChartsData) {
                chartsLabels.push(key);
                if (prevDaysChartsData[key] && prevDaysChartsData[key].stress) {
                    stressChartData.push(Math.round(prevDaysChartsData[key].stress.val / prevDaysChartsData[key].stress.count));
                } else {
                    stressChartData.push(0);
                }
                if (prevDaysChartsData[key] && prevDaysChartsData[key].cognitiveLoad) {
                    cognitiveLoadChartData.push(Math.round(prevDaysChartsData[key].cognitiveLoad.val / prevDaysChartsData[key].cognitiveLoad.count));
                } else {
                    cognitiveLoadChartData.push(0);
                }
                if (prevDaysChartsData[key] && prevDaysChartsData[key].lucidity) {
                    lucidityChartData.push(Math.round(prevDaysChartsData[key].lucidity.val / prevDaysChartsData[key].lucidity.count));
                } else {
                    lucidityChartData.push(0);
                }
                if (prevDaysChartsData[key] && prevDaysChartsData[key].performance) {
                    performanceChartData.push(prevDaysChartsData[key].performance.count);
                } else {
                    performanceChartData.push(0);
                }
                if (prevDaysChartsData[key] && prevDaysChartsData[key].in_range) {
                    inRangeChartData.push(prevDaysChartsData[key].in_range.count);
                } else {
                    inRangeChartData.push(0);
                }
            }
        }
        const xLabel = selectedType === 'currDay' ? 'Время, мин' : 'Дата, дни';
        const yLabel = 'Коллективный уровень';

        return (
            <div className="App">
                <a id="updateTokenLink" target="_self" style={{display: 'none'}}>Token</a>
                <div className="form-check form-check-inline">
                    <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio1"
                           value="currDay" checked={selectedType==='currDay'} onChange={(e)=>this.setState({selectedType: 'currDay'})}/>
                    <label className="form-check-label" htmlFor="inlineRadio1">Текущий день</label>
                </div>
                <div className="form-check form-check-inline">
                    <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio2"
                           value="prevDays" checked={selectedType==='prevDays'} onChange={(e)=>this.setState({selectedType: 'prevDays'})}/>
                    <label className="form-check-label" htmlFor="inlineRadio2">Прошлые дни</label>
                </div>
                <div className="Charts">
                    <div className="chart-block" >
                        <div className="chart-head">
                            <span className="label" style={{color: `rgba(${this.background.lucidity.join(',')}, 1)`}}>Сосредоточенность</span>
                        </div>
                        <div className="chart-body">
                            <ChartBar id="lucidityBar"
                                  content={[{
                                      data: lucidityChartData,
                                      label: 'Сосредоточенность',
                                      color: this.background.lucidity
                                  }]}
                                  labels={chartsLabels}
                                  xLabel={xLabel} yLabel={yLabel}/>
                        </div>
                    </div>

                    <div className="chart-block">
                        <div className="chart-head">
                            <span className="label" style={{color: `rgba(${this.background.stress.join(',')}, 1)`}}>Стресс</span>
                        </div>
                        <div className="chart-body">
                            <ChartBar id="stressBar"
                                  content={[{
                                      data: stressChartData,
                                      label: 'Стресс',
                                      color: this.background.stress
                                  }]}
                                  labels={chartsLabels}
                                  xLabel={xLabel} yLabel={yLabel}/>
                        </div>
                    </div>


                    <div className="chart-block">
                        <div className="chart-head">
                            <span className="label" style={{color: `rgba(${this.background.cognitiveLoad.join(',')}, 1)`}}>Когнитивная нагрузка</span>
                        </div>
                        <div className="chart-body">
                            <ChartBar id="cognitiveLoadBar"
                                  content={[{
                                      data: cognitiveLoadChartData,
                                      label: 'Когнитивная нагрузка',
                                      color: this.background.cognitiveLoad
                                  }]}
                                  labels={chartsLabels}
                                  xLabel={xLabel} yLabel={yLabel}/>
                        </div>
                    </div>

                    <div className="chart-block">
                        <div className="chart-head">
                            <span className="label" style={{color: `rgba(${this.background.performance.join(',')}, 1)`}}>Работоспособность</span>
                        </div>
                        <div className="chart-body">
                            <ChartBar id="courageBar"
                                content={this.isPerfomanceStacked ? [{
                                        data: performanceChartData,
                                        label: 'Вне диапазона/Нет сигнала',
                                        color: this.background.performance
                                    },{
                                        data: inRangeChartData,
                                        label: 'В диапозоне',
                                        color: this.background.in_range
                                    }]
                                    :[{
                                        data: performanceChartData,
                                        label: 'Вне диапазона/Нет сигнала',
                                        color: this.background.performance
                                    }]
                                }
                                labels={chartsLabels}
                                showLegend={this.isPerfomanceStacked}
                                xLabel={xLabel} yLabel="Количество событий"/>
                        </div>
                    </div>
                </div>

                <NotificationContainer/>
            </div>
        )
    }
}

/*function App() {
  return (
    <div className="App">
      <Chart/>
    </div>
  );
}

export default App;*/
