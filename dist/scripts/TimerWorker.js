var _TimerInfos = [];

var TimerElasped = function (Id)
{
    var TimerInfo = _TimerInfos[Id];

    if (!TimerInfo)
    {
        return;
    }

    this.postMessage({
        Action: "ELASPED",
        Id: TimerInfo.Id,
        RunOnce: TimerInfo.RunOnce,
    });
};

this.onmessage = function (e)
{
    var Message = e.data;

    switch (Message.Action)
    {
        case "START":
            var TimerInfo = {
                Id: Message.Id,
                RunOnce: Message.RunOnce,
                TimeOut: Message.TimeOut,
            };

            _TimerInfos[Message.Id] = TimerInfo;

            if (Message.RunOnce == true)
            {
                TimerInfo.TimerId = setTimeout(TimerElasped, Message.TimeOut, Message.Id);
            }
            else
            {
                TimerInfo.TimerId = setInterval(TimerElasped, Message.TimeOut, Message.Id);
            }

            break;

        case "STOP":
            var TimerInfo = _TimerInfos[Message.Id];

            if (!TimerInfo)
            {
                return;
            }

            if (TimerInfo.RunOnce == true)
            {
                clearTimeout(TimerInfo.TimerId);
                delete _TimerInfos[Message.Id];
            }
            else
            {
                clearInterval(TimerInfo.TimerId);
                delete _TimerInfos[Message.Id];
            }

            break;
    }
}
