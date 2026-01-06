import Swal from 'sweetalert2';

// Create a custom Swal configuration with higher z-index
const CustomSwal = Swal.mixin({
    customClass: {
        container: 'swal-container-higher-z',
        popup: 'swal-popup-higher-z'
    }
});

// Add the custom styles
const styles = `
  <style>
    .swal-container-higher-z {
      z-index: 2500 !important;
    }
    .swal-popup-higher-z {
      z-index: 2500 !important;
    }
  </style>
`;

// Add styles to document head
document.head.insertAdjacentHTML('beforeend', styles);

export default CustomSwal;