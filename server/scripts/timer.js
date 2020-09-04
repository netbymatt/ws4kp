if (window.Worker)
{
    var _TimerWorkCallBacks = [];
    var _TimerIds = 0;

    var _TimerWorker = new window.Worker("scripts/TimerWorker.js");
    _TimerWorker.onmessage = function (e)
    {
        var Message = e.data;

        switch (Message.Action)
        {
            case "ELASPED":
                var TimerWorkCallBack = _TimerWorkCallBacks[Message.Id];

                if (!TimerWorkCallBack)
                {
                    return;
                }

                var Window = TimerWorkCallBack.Window;
                var CallBack = TimerWorkCallBack.CallBack;
                var Arguments = TimerWorkCallBack.Arguments;

                if (typeof (CallBack) === 'string')
                {
                    CallBack = new Function(CallBack);
                }
                if (typeof (CallBack) === 'function')
                {
                    CallBack.apply(Window, Arguments);
                }

                if (Message.RunOnce == true)
                {
                    _clearIntervalWorker(Message.Id);
                }
                break;
        }
    };

    window.setIntervalWorker = function (CallBack, TimeOut, Arguments)
    {
        Arguments = Array.prototype.slice.call(arguments).slice(2);
        return _setIntervalWorker(false, CallBack, TimeOut, Arguments, window);
    };
    window.setTimeoutWorker = function (CallBack, TimeOut, Arguments)
    {
        Arguments = Array.prototype.slice.call(arguments).slice(2);
        return _setIntervalWorker(true, CallBack, TimeOut, Arguments, window);
    };
    var _setIntervalWorker = function (RunOnce, CallBack, TimeOut, Arguments, Window)
    {
        var Id = ++_TimerIds;

        _TimerWorkCallBacks[Id] = {
            CallBack: CallBack,
            Arguments: Arguments,
            Window: Window,
        };

        _TimerWorker.postMessage({
            Action: "START",
            RunOnce: RunOnce,
            Id: Id,
            TimeOut: TimeOut,
        });

        return Id;
    };

    window.clearIntervalWorker = function (Id)
    {
        _clearIntervalWorker(Id);
    };
    window.clearTimeoutWorker = function (Id)
    {
        _clearIntervalWorker(Id);
    };
    var _clearIntervalWorker = function (Id)
    {
        if (!Id)
        {
            return;
        }

        _TimerWorker.postMessage({
            Action: "STOP",
            Id: Id,
        });

        delete _TimerWorkCallBacks[Id];
    };
}
