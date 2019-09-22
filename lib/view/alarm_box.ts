import { 
    ClientAlarmList,
    EventStuff 
} from "node-opcua-client";

function ellipsys(a: any) {
    if(!a) { return ""; }
    return a.toString();
//    return truncate(a,20,{ position: "middle"});
}
function n(a: any) {
    if (a===null || a === undefined) {
        return "";
    }
    return a.toString();
}
function f(flag: boolean): string {
    return flag ? "X" : "_";
}
export async function updateAlarmBox(clientAlarms: ClientAlarmList, alarmBox: any, headers: any) {

    const data = [ headers ];
    
    for(const alarm of clientAlarms.alarms()) {

        const fields = alarm.fields as any;
        const isEnabled = (fields as any).enabledState.id.value;
        data.push([
            alarm.eventType.toString(),
            alarm.conditionId.toString(),
            // fields.branchId.value.toString(),
            // ellipsys(alarm.eventId.toString("hex")),
            isEnabled ? ellipsys(fields.message.value) : "-",
            isEnabled ? fields.severity.value + ' (' + fields.lastSeverity.value + ')' : "-",
            (f(isEnabled)) +
            (isEnabled ? f(fields.activeState.id.value): "-") +
            (isEnabled ? f(fields.ackedState.id.value): "-" )+
            (isEnabled ? f(fields.confirmedState.id.value): "-"),
           // (isEnabled ? f(fields.retain.value) : "-"),
            (isEnabled ? ellipsys(fields.comment.value) : "-"),
        ])
    }
    alarmBox.setRows(data);
    alarmBox.screen.render();
}
