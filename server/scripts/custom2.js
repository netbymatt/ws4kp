document.addEventListener('DOMContentLoaded', () => {
	addDonationLink();
});

const addDonationLink = () => {
	// add link to donation page
	const info = document.querySelector('.info');

	const donationLink = document.createElement('div'); donationLink.innerHTML = `
		<div class="bmc-btn-container"><a style="font-family: 'Star4000';
		color: #faff10;
		background-color: #26235a !important;
		height: 47px;
		border-radius: 5px;
		font-size: 17px;
		border: none;
		padding: 0px 10px;
		text-decoration: none !important;
		display: inline-flex !important;
		align-items: center;
		box-sizing: border-box !important;
		"
		class="bmc-btn" target="_blank" href="http://buymeacoffee.com/temp.exp">☂️<span class="bmc-btn-text">Buy me an umbrella</span></a></div>
		`;

	info.append(donationLink);
};
