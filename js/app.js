/********************************************************/

const App = (() => {

let currentView = "dashboard";
let confirmCallback = null;


/*--------------------------------*/

function safeRun(callback){

    try{
        callback();
    }
    catch(error){

        console.error(error);

    }

}


/*--------------------------------*/

function init(){


    safeRun(()=>SettingsUI.init());
    safeRun(()=>ClientsUI.init());
    safeRun(()=>TransactionsUI.init());
    safeRun(()=>VoiceUI.init());


    setupNav();
    setupModals();
    setupMobileMenu();
    setupFloatingVoice();


    const txDate=document.getElementById("txDateInput");

    if(txDate){
        txDate.value=Utils.todayISO();
    }


    const vrDate=document.getElementById("vrDate");

    if(vrDate){
        vrDate.value=Utils.todayISO();
    }



    safeRun(()=>ClientsUI.renderClientsTable());
    safeRun(()=>TransactionsUI.renderTxTable());
    safeRun(()=>ClientsUI.refreshClientNameLists());
    safeRun(()=>refreshDashboard());


    setTimeout(()=>{

        const splash=document.getElementById("splash");

        if(splash){
            splash.remove();
        }

    },1700);

}


/*--------------------------------*/

function setupNav(){

    document
    .querySelectorAll(".nav-item[data-view]")
    .forEach((btn)=>{

        btn.addEventListener("click",()=>{

            navigate(btn.dataset.view);

        });

    });


    document
    .querySelectorAll("[data-goto]")
    .forEach((btn)=>{

        btn.addEventListener("click",()=>{

            navigate(btn.dataset.goto);

        });

    });

}


/*--------------------------------*/

function navigate(viewName){

    currentView=viewName;


    document
    .querySelectorAll(".view")
    .forEach((item)=>{

        item.classList.remove("active");

    });


    const target=document.getElementById(`view-${viewName}`);


    if(target){

        target.classList.add("active");

    }


    document
    .querySelectorAll(".nav-item[data-view]")
    .forEach((item)=>{

        item.classList.toggle(
            "active",
            item.dataset.view===viewName
        );

    });



    if(viewName==="dashboard"){

        safeRun(()=>refreshDashboard());

    }


    if(viewName==="clients"){

        safeRun(()=>ClientsUI.renderClientsTable());

    }


    if(viewName==="transactions"){

        safeRun(()=>TransactionsUI.renderTxTable());

    }


    if(viewName==="reports"){

        safeRun(()=>renderReports());

    }



    closeMobileSidebar();


    window.scrollTo({

        top:0,
        behavior:"smooth"

    });

}


/*--------------------------------*/

function getCurrentView(){

    return currentView;

}


/*--------------------------------*/

function setupModals(){


    document
    .querySelectorAll("[data-close]")
    .forEach((btn)=>{

        btn.addEventListener("click",()=>{

            hideModal(btn.dataset.close);

        });

    });



    document
    .querySelectorAll(".modal-overlay")
    .forEach((overlay)=>{

        overlay.addEventListener("click",(e)=>{

            if(e.target===overlay){

                hideModal(overlay.id);

            }

        });

    });



    document.addEventListener("keydown",(e)=>{


        if(e.key==="Escape"){


            document
            .querySelectorAll(".modal-overlay")
            .forEach((modal)=>{


                if(!modal.hidden){

                    hideModal(modal.id);

                }

            });

        }


    });



    const confirmBtn=
    document.getElementById("confirmActionBtn");


    if(confirmBtn){

        confirmBtn.onclick=()=>{


            if(confirmCallback){

                confirmCallback();

            }

            hideModal("confirmModal");

        };

    }

}


/*--------------------------------*/

function showModal(id){

    const modal=document.getElementById(id);

    if(modal){

        modal.hidden=false;

    }

}


/*--------------------------------*/

function hideModal(id){

    const modal=document.getElementById(id);

    if(modal){

        modal.hidden=true;

    }

}


/*--------------------------------*/

function confirmAction(title,message,callback){

    document.getElementById("confirmTitle").textContent=title;
    document.getElementById("confirmMessage").textContent=message;

    confirmCallback=callback;

    showModal("confirmModal");

}


/*--------------------------------*/

function setupMobileMenu(){


    const btn=document.getElementById("mobileMenuBtn");
    const btnNew=document.getElementById("mobileMenuBtnNew");
    const sidebar=document.getElementById("sidebar");
    const overlay=document.getElementById("sidebarOverlay");


    const openMenu = ()=>{
        sidebar.classList.add("open");
        overlay.classList.add("show");
    };

    if(btn){
        btn.addEventListener("click", openMenu);
    }
    if(btnNew){
        btnNew.addEventListener("click", openMenu);
    }


    if(overlay){

        overlay.addEventListener(
            "click",
            closeMobileSidebar
        );

    }

}


/*--------------------------------*/

function closeMobileSidebar(){

    const sidebar=document.getElementById("sidebar");
    const overlay=document.getElementById("sidebarOverlay");


    if(sidebar){

        sidebar.classList.remove("open");

    }


    if(overlay){

        overlay.classList.remove("show");

    }

}


/*--------------------------------*/

function setupFloatingVoice(){

    const fab = document.getElementById("floatingVoiceBtn");

    if(fab){
        fab.addEventListener("click",()=>{
            navigate("voice");
            // بدء التسجيل تلقائياً عند النقر على الزر العائم لسهولة الاستخدام
            setTimeout(()=>{
                const micBtn = document.getElementById("micBtn");
                if(micBtn) micBtn.click();
            }, 300);
        });
    }

}


/*--------------------------------*/

function refreshDashboard(){

    if(typeof DB==="undefined"){
        return;
    }

    const totals=DB.totals();


    const debt=
    document.getElementById("statTotalDebt");


    if(debt){

        debt.textContent=
        Utils.formatNumber(totals.debt);

    }


    const paid=
    document.getElementById("statTotalPaid");


    if(paid){

        paid.textContent=
        Utils.formatNumber(totals.paid);

    }


    const balance=
    document.getElementById("statNetBalance");


    if(balance){

        balance.textContent=
        Utils.formatNumber(
            Math.max(0,totals.balance)
        );

    }


    const clients=
    document.getElementById("statClientCount");


    if(clients){

        clients.textContent=
        DB.getClients().length;

    }


    if(typeof renderTopDebtors==="function"){
        safeRun(()=>renderTopDebtors("topDebtorsList",5));
    }

    if(typeof renderRecentTx==="function"){
        safeRun(()=>renderRecentTx());
    }

}


/*--------------------------------*/

return{

    init,
    navigate,
    getCurrentView,
    refreshDashboard,
    showModal,
    hideModal,
    confirmAction

};


})();


document.addEventListener(
    "DOMContentLoaded",
    App.init
);
